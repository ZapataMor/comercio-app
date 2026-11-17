/**
 * Fotos del fondo del login, por modo (día/noche según la hora, como el
 * tema). `direccion` es opcional: si se llena, sale debajo del nombre del
 * lugar en la esquina inferior izquierda.
 */
import { ImageSourcePropType } from 'react-native';
import { ModoVitrina } from '../Logo';

export type FotoLogin = {
  imagen: ImageSourcePropType;
  lugar: string;
  direccion?: string;
};

export const FOTOS_LOGIN: Record<ModoVitrina, FotoLogin[]> = {
  dia: [
    { imagen: require('../../../assets/login/dia/mezquita.jpg'), lugar: 'Mezquita Omar Ibn Al-Khattab' },
    { imagen: require('../../../assets/login/dia/mazorca.jpg'), lugar: 'Escultura de la mazorca' },
    { imagen: require('../../../assets/login/dia/letrero.jpg'), lugar: 'Letrero de Maicao' },
    { imagen: require('../../../assets/login/dia/centro.jpg'), lugar: 'Centro de Maicao' },
  ],
  noche: [
    { imagen: require('../../../assets/login/noche/mezquita.jpg'), lugar: 'Mezquita Omar Ibn Al-Khattab' },
    { imagen: require('../../../assets/login/noche/mazorca.jpg'), lugar: 'Escultura de la mazorca' },
    { imagen: require('../../../assets/login/noche/letrero.jpg'), lugar: 'Letrero de Maicao' },
    { imagen: require('../../../assets/login/noche/mezquita_aerea.jpg'), lugar: 'Mezquita Omar Ibn Al-Khattab' },
  ],
};
