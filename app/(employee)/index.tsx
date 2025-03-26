import React from 'react';
import { View, StyleSheet } from 'react-native';
import TimeControl from '@/components/TimeControl';

export default function Index() {
  return (
    <View style={styles.container}>
      <TimeControl />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});