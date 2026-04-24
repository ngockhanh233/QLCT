import Svg, { Circle, Path } from 'react-native-svg';

type Props = {
  width?: number;
  height?: number;
  color?: string;
};

const ClockIcon = ({ width = 24, height = 24, color = '#000' }: Props) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
    <Path
      d="M12 7v5l3 2"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default ClockIcon;
