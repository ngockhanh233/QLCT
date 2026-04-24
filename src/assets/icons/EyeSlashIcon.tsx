import Svg, { Path } from 'react-native-svg';

type Props = {
  width?: number;
  height?: number;
  color?: string;
};

const EyeSlashIcon = ({ width = 24, height = 24, color = '#000' }: Props) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M9.88 4.24A9.75 9.75 0 0 1 12 4c6.5 0 10 8 10 8a15.72 15.72 0 0 1-2.18 3.19M17.94 17.94A9.8 9.8 0 0 1 12 20c-6.5 0-10-8-10-8a15.7 15.7 0 0 1 4.06-5.06"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M9.9 9.9a3 3 0 0 0 4.2 4.2"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M2 2l20 20"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default EyeSlashIcon;
