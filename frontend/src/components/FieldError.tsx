import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { c, font } from '../theme';

export default function FieldError({ mensaje }: { mensaje?: string | null }) {
  if (!mensaje) return null;
  return <Text style={styles.text}>{mensaje}</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: c.danger,
    fontFamily: font.medium,
    fontSize: 12,
    marginTop: -10,
    marginBottom: 12,
  },
});
