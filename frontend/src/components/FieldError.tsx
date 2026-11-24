import React from 'react';
import { Text } from 'react-native';
import { font, makeStyles } from '../theme';

export default function FieldError({ mensaje }: { mensaje?: string | null }) {
  const styles = useStyles();
  if (!mensaje) return null;
  return <Text style={styles.text}>{mensaje}</Text>;
}

const useStyles = makeStyles(c => ({
  text: {
    color: c.danger,
    fontFamily: font.medium,
    fontSize: 13,
    lineHeight: 18,
    marginTop: -8,
    marginBottom: 12,
  },
}));
