import Svg, { Path } from 'react-native-svg';

type Props = {
  width?: number;
  height?: number;
  color?: string;
};

const CheckIcon = ({ width = 24, height = 24, color = '#000' }: Props) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 12l5 5L20 7"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default CheckIcon;
