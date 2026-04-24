import Svg, { Path, Circle } from 'react-native-svg';

type Props = {
  width?: number;
  height?: number;
  color?: string;
};

const EyeIcon = ({ width = 24, height = 24, color = '#000' }: Props) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={2} />
  </Svg>
);

export default EyeIcon;
