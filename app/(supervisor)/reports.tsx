import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, ImageBackground } from 'react-native';
import { supabase } from '@/lib/supabase';
import { ChartBar as BarChart, FileText, Download, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { Picker } from '@react-native-picker/picker';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import DatePicker from '@/components/DatePicker';

interface DailyReport {
  date: string;
  clock_in: string;
  clock_out: string;
  break_duration: string;
  total_hours: number;
}

interface Report {
  employee: {
    fiscal_name: string;
    email: string;
    work_centers: string[];
    document_number: string;
  };
  date: string;
  entry_type: string;
  timestamp: string;
  work_center?: string;
  total_hours?: number;
  daily_reports?: DailyReport[];
  monthly_hours?: number[];
  company?: {
    fiscal_name: string;
    nif: string;
  };
}

export default function SupervisorReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [reportType, setReportType] = useState<'daily' | 'annual' | 'official' | 'alarms'>('daily');
  const [selectedWorkCenter, setSelectedWorkCenter] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [workCenters, setWorkCenters] = useState<string[]>([]);
  const [hoursLimit, setHoursLimit] = useState<number>(40);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companyInfo, setCompanyInfo] = useState<{fiscal_name: string, nif: string} | null>(null);

  useEffect(() => {
    fetchSupervisorInfo();
  }, []);

  const fetchSupervisorInfo = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const supervisorEmail = await SecureStore.getItemAsync('supervisorEmail');
      if (!supervisorEmail) {
        throw new Error('No se encontró el correo electrónico del supervisor');
      }

      // Obtener información del supervisor y de la empresa
      const { data: supervisorData, error: supervisorError } = await supabase
        .from('supervisor_profiles')
        .select('*, company:company_id(fiscal_name, nif)')
        .eq('email', supervisorEmail)
        .single();

      if (supervisorError) throw supervisorError;
      if (!supervisorData?.work_centers?.length) {
        throw new Error('No se encontraron centros de trabajo asignados');
      }

      // Establecer información de la empresa si está disponible
      if (supervisorData.company) {
        setCompanyInfo({
          fiscal_name: supervisorData.company.fiscal_name,
          nif: supervisorData.company.nif
        });
      }

      setWorkCenters(supervisorData.work_centers);
      setSelectedWorkCenter(supervisorData.work_centers[0]);

      // Obtener empleados bajo supervisión
      const { data: employeesData, error: employeesError } = await supabase
        .from('employee_profiles')
        .select('*')
        .overlaps('work_centers', supervisorData.work_centers)
        .eq('is_active', true);

      if (employeesError) throw employeesError;
      setEmployees(employeesData || []);

    } catch (err) {
      console.error('Error fetching supervisor info:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar los datos');
    } finally {
      setIsLoading(false);
    }
  };

  const generateReport = async () => {
    setIsLoading(true);

    try {
      if (!selectedWorkCenter) return;

      const startDateStr = startDate ? startDate.toISOString() : '';
      const endDateStr = endDate ? endDate.toISOString() : '';

      const workCenterEmployees = selectedWorkCenter 
        ? employees.filter(emp => emp.work_centers.includes(selectedWorkCenter))
        : employees;

      if (workCenterEmployees.length === 0) {
        throw new Error('No hay empleados asignados al centro de trabajo seleccionado');
      }

      const { data: timeEntries } = await supabase
        .from('time_entries')
        .select('*')
        .in('employee_id', workCenterEmployees.map(emp => emp.id))
        .eq('is_active', true)
        .gte('timestamp', reportType === 'annual' 
          ? `${selectedYear || new Date().getFullYear()}-01-01` 
          : startDateStr)
        .lte('timestamp', reportType === 'annual' 
          ? `${selectedYear || new Date().getFullYear()}-12-31` 
          : endDateStr)
        .order('timestamp', { ascending: true });

      if (!timeEntries) return;

      let reportData: Report[] = [];

      switch (reportType) {
        case 'daily': {
          const entriesByEmployeeAndDate = timeEntries.reduce((acc, entry) => {
            const employeeId = entry.employee_id;
            const date = entry.timestamp.split('T')[0];
            if (!acc[employeeId]) acc[employeeId] = {};
            if (!acc[employeeId][date]) acc[employeeId][date] = [];
            acc[employeeId][date].push(entry);
            return acc;
          }, {});

          for (const employeeId of Object.keys(entriesByEmployeeAndDate)) {
            const employee = workCenterEmployees.find(emp => emp.id === employeeId);
            if (!employee) continue;

            for (const date of Object.keys(entriesByEmployeeAndDate[employeeId])) {
              const entries = entriesByEmployeeAndDate[employeeId][date];
              let totalHours = 0;
              let clockInTime = null;
              let breakStartTime = null;

              entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                .forEach(entry => {
                  const time = new Date(entry.timestamp).getTime();

                  switch (entry.entry_type) {
                    case 'clock_in':
                      clockInTime = time;
                      break;
                    case 'break_start':
                      if (clockInTime) {
                        totalHours += (time - clockInTime) / (1000 * 60 * 60);
                        clockInTime = null;
                      }
                      breakStartTime = time;
                      break;
                    case 'break_end':
                      clockInTime = time;
                      breakStartTime = null;
                      break;
                    case 'clock_out':
                      if (clockInTime) {
                        totalHours += (time - clockInTime) / (1000 * 60 * 60);
                        clockInTime = null;
                      }
                      break;
                  }
                });

              reportData.push({
                employee: {
                  fiscal_name: employee.fiscal_name,
                  email: employee.email,
                  work_centers: employee.work_centers,
                  document_number: employee.document_number
                },
                date,
                entry_type: '',
                timestamp: '',
                total_hours: totalHours,
                company: companyInfo || undefined
              });
            }
          }
          break;
        }

        case 'annual': {
          const entriesByEmployee = timeEntries.reduce((acc, entry) => {
            const employeeId = entry.employee_id;
            const month = new Date(entry.timestamp).getMonth();
            if (!acc[employeeId]) {
              acc[employeeId] = Array(12).fill(0);
            }
            return acc;
          }, {});

          for (const employeeId of Object.keys(entriesByEmployee)) {
            const employee = workCenterEmployees.find(emp => emp.id === employeeId);
            if (!employee) continue;

            const employeeEntries = timeEntries.filter(entry => entry.employee_id === employeeId);
            let totalHours = 0;
            const monthlyHours = Array(12).fill(0);

            let clockInTime = null;
            let breakStartTime = null;

            employeeEntries.forEach(entry => {
              const time = new Date(entry.timestamp).getTime();
              const month = new Date(entry.timestamp).getMonth();

              switch (entry.entry_type) {
                case 'clock_in':
                  clockInTime = time;
                  break;
                case 'break_start':
                  if (clockInTime) {
                    const hours = (time - clockInTime) / (1000 * 60 * 60);
                    monthlyHours[month] += hours;
                    totalHours += hours;
                    clockInTime = null;
                  }
                  breakStartTime = time;
                  break;
                case 'break_end':
                  clockInTime = time;
                  breakStartTime = null;
                  break;
                case 'clock_out':
                  if (clockInTime) {
                    const hours = (time - clockInTime) / (1000 * 60 * 60);
                    monthlyHours[month] += hours;
                    totalHours += hours;
                    clockInTime = null;
                  }
                  break;
              }
            });

            reportData.push({
              employee: {
                fiscal_name: employee.fiscal_name,
                email: employee.email,
                work_centers: employee.work_centers,
                document_number: employee.document_number
              },
              date: `${selectedYear || new Date().getFullYear()}`,
              entry_type: '',
              timestamp: '',
              total_hours: totalHours,
              monthly_hours: monthlyHours,
              company: companyInfo || undefined
            });
          }
          break;
        }

        case 'official': {
          if (!selectedEmployee) break;

          const employee = workCenterEmployees.find(emp => emp.id === selectedEmployee);
          if (!employee) break;

          const start = startDate || new Date();
          const end = endDate || new Date();
          const daysInRange = [];
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            daysInRange.push(new Date(d));
          }

          const employeeEntries = timeEntries.filter(entry => entry.employee_id === selectedEmployee);

          const dailyReports: DailyReport[] = daysInRange.map(date => {
            const dateKey = date.toISOString().split('T')[0];
            const entries = employeeEntries.filter(entry => entry.timestamp.startsWith(dateKey));

            const clockIn = entries.find(e => e.entry_type === 'clock_in')?.timestamp;
            const clockOut = entries.find(e => e.entry_type === 'clock_out')?.timestamp;

            let breakDuration = 0;
            let breakStart = null;
            entries.forEach(entry => {
              if (entry.entry_type === 'break_start') {
                breakStart = new Date(entry.timestamp);
              } else if (entry.entry_type === 'break_end' && breakStart) {
                breakDuration += (new Date(entry.timestamp).getTime() - breakStart.getTime());
                breakStart = null;
              }
            });

            let totalHours = 0;
            if (clockIn && clockOut) {
              const start = new Date(clockIn);
              const end = new Date(clockOut);
              totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
              totalHours -= breakDuration / (1000 * 60 * 60);
            }

            return {
              date: date.toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
              }),
              clock_in: clockIn ? new Date(clockIn).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '',
              clock_out: clockOut ? new Date(clockOut).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '',
              break_duration: breakDuration > 0 ? `${Math.floor(breakDuration / (1000 * 60 * 60))}:${Math.floor((breakDuration % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0')}` : '',
              total_hours: totalHours
            };
          });

          reportData = [{
            employee: {
              fiscal_name: employee.fiscal_name,
              email: employee.email,
              work_centers: employee.work_centers,
              document_number: employee.document_number
            },
            date: startDate ? startDate.toISOString().split('T')[0] : '',
            entry_type: '',
            timestamp: '',
            daily_reports: dailyReports,
            company: companyInfo || undefined
          }];
          break;
        }

        case 'alarms': {
          const entriesByEmployee = timeEntries.reduce((acc, entry) => {
            const employeeId = entry.employee_id;
            if (!acc[employeeId]) acc[employeeId] = [];
            acc[employeeId].push(entry);
            return acc;
          }, {});

          for (const employeeId of Object.keys(entriesByEmployee)) {
            const employee = workCenterEmployees.find(emp => emp.id === employeeId);
            if (!employee) continue;

            const entries = entriesByEmployee[employeeId];
            let totalHours = 0;
            let clockInTime = null;
            let breakStartTime = null;

            entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
              .forEach(entry => {
                const time = new Date(entry.timestamp).getTime();

                switch (entry.entry_type) {
                  case 'clock_in':
                    clockInTime = time;
                    break;
                  case 'break_start':
                    if (clockInTime) {
                      totalHours += (time - clockInTime) / (1000 * 60 * 60);
                      clockInTime = null;
                    }
                    breakStartTime = time;
                    break;
                  case 'break_end':
                    clockInTime = time;
                    breakStartTime = null;
                    break;
                  case 'clock_out':
                    if (clockInTime) {
                      totalHours += (time - clockInTime) / (1000 * 60 * 60);
                      clockInTime = null;
                    }
                    break;
                }
              });

            if (totalHours > hoursLimit) {
              reportData.push({
                employee: {
                  fiscal_name: employee.fiscal_name,
                  email: employee.email,
                  work_centers: employee.work_centers,
                  document_number: employee.document_number
                },
                date: startDate ? startDate.toISOString().split('T')[0] : '',
                entry_type: '',
                timestamp: '',
                total_hours: totalHours,
                company: companyInfo || undefined
              });
            }
          }
          break;
        }
      }

      setReports(reportData);
    } catch (err) {
      console.error('Error generating report:', err);
      setError(err instanceof Error ? err.message : 'Error al generar el informe');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    console.log("Datos actuales:", { 
      selectedEmployee, 
      startDate, 
      endDate, 
      reports,
      reportType 
    });

    if (reportType === 'official') {
      if (!selectedEmployee || !startDate || !endDate) {
        alert('Por favor seleccione un empleado y el rango de fechas');
        return;
      }

      const report = reports[0];
      console.log("Reporte seleccionado:", report);

      if (!report || !report.daily_reports || report.daily_reports.length === 0) {
        alert('No hay datos para generar el PDF. Datos recibidos: ' + JSON.stringify(report));
        return;
      }

      try {
        setIsLoading(true);
        
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([600, 800]);
        const { height } = page.getSize();
        
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        
        let y = height - 50;
        let currentPage = page;

        const drawText = (text: string, x: number, y: number, size: number = 12, bold: boolean = false) => {
          currentPage.drawText(text, { 
            x, 
            y, 
            size, 
            font: bold ? font : regularFont,
            color: rgb(0, 0, 0)
          });
        };

        drawText('Listado mensual del registro de jornada', 50, y, 16, true);
        y -= 30;

        // Usar la información de la empresa desde companyInfo
        drawText(`Empresa: ${companyInfo?.fiscal_name || 'Empresa no disponible'}`, 50, y);
        drawText(`Trabajador: ${report.employee.fiscal_name}`, 300, y);
        y -= 20;

        drawText(`C.I.F/N.I.F: ${companyInfo?.nif || 'NIF no disponible'}`, 50, y);
        drawText(`N.I.F: ${report.employee.document_number}`, 300, y);
        y -= 20;

        drawText(`Centro de Trabajo: ${report.employee.work_centers.join(', ')}`, 50, y);
        drawText(`Nº Afiliación: 281204329001`, 300, y);
        y -= 20;

        drawText(`C.C.C:`, 50, y);
        drawText(`Mes y Año: ${startDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`, 300, y);
        y -= 30;

        drawText('DÍA', 50, y, 12, true);
        drawText('ENTRADA', 150, y, 12, true);
        drawText('SALIDA', 250, y, 12, true);
        drawText('PAUSAS', 350, y, 12, true);
        drawText('HORAS', 450, y, 12, true);
        y -= 20;

        currentPage.drawLine({
          start: { x: 50, y: y + 5 },
          end: { x: 550, y: y + 5 },
          thickness: 1,
          color: rgb(0, 0, 0),
        });
        y -= 15;

        report.daily_reports.forEach(day => {
          if (y < 100) {
            currentPage = pdfDoc.addPage([600, 800]);
            y = height - 50;
          }
          
          drawText(day.date, 50, y);
          drawText(day.clock_in, 150, y);
          drawText(day.clock_out, 250, y);
          drawText(day.break_duration, 350, y);
          drawText(day.total_hours ? `${Math.floor(day.total_hours)}:${Math.round((day.total_hours % 1) * 60).toString().padStart(2, '0')}` : '0:00', 450, y);
          y -= 20;
        });

        const totalHours = report.daily_reports.reduce((acc, day) => acc + (day.total_hours || 0), 0);
        y -= 20;
        drawText('TOTAL HORAS:', 350, y, 12, true);
        drawText(`${Math.floor(totalHours)}:${Math.round((totalHours % 1) * 60).toString().padStart(2, '0')}`, 450, y, 12, true);
        y -= 30;

        drawText('Firma de la Empresa:', 50, y);
        drawText('Firma del Trabajador:', 300, y);
        y -= 40;

        drawText('En Madrid, a ' + new Date().toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }), 50, y);
        y -= 20;

        const legalText = 'Registro realizado en cumplimiento del Real Decreto-ley 8/2019, de 8 de marzo, de medidas urgentes de protección social y de lucha contra la precariedad laboral en la jornada de trabajo ("BOE" núm. 61 de 12 de marzo), la regulación de forma expresa en el artículo 34 del texto refundido de la Ley del Estatuto de los Trabajadores (ET), la obligación de las empresas de registrar diariamente la jornada laboral.';
        currentPage.drawText(legalText, { 
          x: 50, 
          y, 
          size: 10, 
          font: regularFont,
          maxWidth: 500,
          lineHeight: 12
        });

        const pdfBytes = await pdfDoc.save();
        const fileName = `informe_oficial_${report.employee.fiscal_name.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        const fileUri = FileSystem.documentDirectory + fileName;
        
        const base64Data = btoa(String.fromCharCode.apply(null, pdfBytes));
        
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64
        });

        if (!(await Sharing.isAvailableAsync())) {
          alert('La función de compartir no está disponible en este dispositivo');
          return;
        }

        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Compartir Informe Oficial',
          UTI: 'com.adobe.pdf'
        });

      } catch (error) {
        console.error('Error al generar PDF:', error);
        alert('Error al generar el PDF: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    } else {
      try {
        setIsLoading(true);
        
        let csvContent = '';
        
        if (reportType === 'daily') {
          csvContent += 'Empleado,Email,Centro de Trabajo,Fecha,Horas Trabajadas\n';
          reports.forEach(report => {
            csvContent += `"${report.employee.fiscal_name}","${report.employee.email}","${report.employee.work_centers.join(', ')}","${report.date}",${report.total_hours?.toFixed(2)}\n`;
          });
        } else if (reportType === 'annual') {
          csvContent += 'Empleado,Email,Centro de Trabajo,Año,Ene,Feb,Mar,Abr,May,Jun,Jul,Ago,Sep,Oct,Nov,Dic,Total\n';
          reports.forEach(report => {
            csvContent += `"${report.employee.fiscal_name}","${report.employee.email}","${report.employee.work_centers.join(', ')}","${report.date}",`;
            report.monthly_hours?.forEach(hours => {
              csvContent += `${hours.toFixed(2)},`;
            });
            csvContent += `${report.total_hours?.toFixed(2)}\n`;
          });
        } else if (reportType === 'alarms') {
          csvContent += 'Empleado,Email,Centro de Trabajo,Fecha,Horas Trabajadas,Límite Excedido\n';
          reports.forEach(report => {
            const exceeded = report.total_hours && report.total_hours > hoursLimit 
              ? (report.total_hours - hoursLimit).toFixed(2) 
              : '0.00';
            csvContent += `"${report.employee.fiscal_name}","${report.employee.email}","${report.employee.work_centers.join(', ')}","${report.date}",${report.total_hours?.toFixed(2)},${exceeded}\n`;
          });
        }
        
        const fileName = `informe_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
        const fileUri = FileSystem.documentDirectory + fileName;
        
        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8
        });

        if (!(await Sharing.isAvailableAsync())) {
          alert('La función de compartir no está disponible en este dispositivo');
          return;
        }

        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Exportar Informe',
          UTI: 'public.comma-separated-values-text'
        });

      } catch (error) {
        console.error('Error al exportar:', error);
        alert('Error al exportar el informe: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <ImageBackground 
      source={{ uri: 'https://images.unsplash.com/photo-1497215842964-222b430dc094?q=80&w=2070&auto=format&fit=crop' }}
      style={styles.container}
      imageStyle={styles.backgroundImage}
    >
      <View style={styles.overlay}>
        <ScrollView style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Informes</Text>
            <Text style={styles.subtitle}>
              Generación y exportación de reportes
            </Text>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.filterContainer}>
            <View style={styles.filterSection}>
              <Text style={styles.label}>Tipo de Informe</Text>
              <Picker
                selectedValue={reportType}
                onValueChange={(itemValue) => setReportType(itemValue)}
                style={styles.picker}
              >
                <Picker.Item label="Resumen Diario" value="daily" />
                <Picker.Item label="Resumen Anual" value="annual" />
                <Picker.Item label="Informe Oficial" value="official" />
                <Picker.Item label="Alarmas" value="alarms" />
              </Picker>
            </View>

            {reportType === 'official' ? (
              <View style={styles.filterSection}>
                <Text style={styles.label}>Empleado</Text>
                <Picker
                  selectedValue={selectedEmployee}
                  onValueChange={(itemValue) => setSelectedEmployee(itemValue)}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar empleado" value="" />
                  {employees.map((emp) => (
                    <Picker.Item key={emp.id} label={emp.fiscal_name} value={emp.id} />
                  ))}
                </Picker>
              </View>
            ) : (
              <>
                <View style={styles.filterSection}>
                  <Text style={styles.label}>Centro de Trabajo</Text>
                  <Picker
                    selectedValue={selectedWorkCenter}
                    onValueChange={(itemValue) => setSelectedWorkCenter(itemValue)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Todos los centros" value="" />
                    {workCenters.map((center) => (
                      <Picker.Item key={center} label={center} value={center} />
                    ))}
                  </Picker>
                </View>

                {reportType === 'alarms' && (
                  <View style={styles.filterSection}>
                    <Text style={styles.label}>Límite de Horas</Text>
                    <TextInput
                      style={styles.input}
                      value={hoursLimit.toString()}
                      onChangeText={(text) => {
                        const value = parseInt(text);
                        if (!isNaN(value) && value > 0) {
                          setHoursLimit(value);
                        }
                      }}
                      keyboardType="numeric"
                      placeholder="Límite de horas"
                    />
                  </View>
                )}
              </>
            )}

            {(reportType === 'daily' || reportType === 'official' || reportType === 'alarms') && (
              <>
                <View style={styles.filterSection}>
                  <Text style={styles.label}>Fecha Inicio</Text>
                  <DatePicker
                    value={startDate}
                    onChange={setStartDate}
                    label="Seleccionar fecha inicio"
                  />
                </View>

                <View style={styles.filterSection}>
                  <Text style={styles.label}>Fecha Fin</Text>
                  <DatePicker
                    value={endDate}
                    onChange={setEndDate}
                    label="Seleccionar fecha fin"
                  />
                </View>
              </>
            )}

            {reportType === 'annual' && (
              <View style={styles.filterSection}>
                <Text style={styles.label}>Año</Text>
                <Picker
                  selectedValue={selectedYear || ''}
                  onValueChange={(itemValue) => setSelectedYear(itemValue)}
                  style={styles.picker}
                >
                  <Picker.Item label="Seleccionar año" value="" />
                  {Array.from({ length: 10 }, (_, i) => (
                    <Picker.Item key={i} label={(new Date().getFullYear() - i).toString()} value={new Date().getFullYear() - i} />
                  ))}
                </Picker>
              </View>
            )}

            <TouchableOpacity style={styles.generateButton} onPress={generateReport}>
              <Text style={styles.generateButtonText}>Generar Informe</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.exportButton} onPress={handleExport} disabled={reports.length === 0}>
            <Download size={20} color="#ffffff" />
            <Text style={styles.exportButtonText}>
              {reportType === 'official' ? 'Generar PDF' : 'Exportar a Excel'}
            </Text>
          </TouchableOpacity>

          {isLoading ? (
            <ActivityIndicator size="large" color="#6d28d9" style={styles.loader} />
          ) : reports.length > 0 ? (
            <View style={styles.reportsContainer}>
              {reports.map((report, index) => (
                <View key={index} style={styles.reportCard}>
                  <Text style={styles.employeeName}>{report.employee.fiscal_name}</Text>
                  <Text style={styles.employeeEmail}>{report.employee.email}</Text>
                  <Text style={styles.employeeWorkCenters}>
                    {report.employee.work_centers.join(', ')}
                  </Text>
                  {reportType === 'daily' ? (
                    <>
                      <Text style={styles.reportDate}>{report.date}</Text>
                      <Text style={styles.totalHours}>
                        Total Horas: {report.total_hours?.toFixed(2)}h
                      </Text>
                    </>
                  ) : reportType === 'annual' ? (
                    <>
                      <Text style={styles.reportDate}>{report.date}</Text>
                      <View style={styles.monthlyHoursContainer}>
                        {report.monthly_hours?.map((hours, i) => (
                          <Text key={i} style={styles.monthlyHours}>
                            {new Date(0, i).toLocaleString('es-ES', { month: 'short' })}: {hours.toFixed(2)}h
                          </Text>
                        ))}
                      </View>
                      <Text style={styles.totalHours}>
                        Total Horas: {report.total_hours?.toFixed(2)}h
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.totalHours}>
                      Total Horas: {report.total_hours?.toFixed(2)}h
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noDataText}>No hay datos para mostrar</Text>
          )}
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    opacity: 0.1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    color: '#111827',
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    fontFamily: 'Inter_400Regular',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  filterContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    color: '#374151',
    fontFamily: 'Inter_600SemiBold',
  },
  picker: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  generateButton: {
    backgroundColor: '#6d28d9',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  generateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  exportButton: {
    backgroundColor: '#10b981',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  exportButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  loader: {
    marginVertical: 40,
  },
  reportsContainer: {
    gap: 16,
  },
  reportCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    fontFamily: 'Inter_600SemiBold',
  },
  employeeEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
    fontFamily: 'Inter_400Regular',
  },
  employeeWorkCenters: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    fontFamily: 'Inter_400Regular',
  },
  reportDate: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
    fontFamily: 'Inter_500Medium',
  },
  totalHours: {
    fontSize: 14,
    color: '#1e40af',
    marginTop: 8,
    fontFamily: 'Inter_600SemiBold',
  },
  monthlyHoursContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  monthlyHours: {
    fontSize: 12,
    color: '#4b5563',
    fontFamily: 'Inter_400Regular',
  },
  noDataText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
    marginVertical: 40,
    fontFamily: 'Inter_400Regular',
  },
});