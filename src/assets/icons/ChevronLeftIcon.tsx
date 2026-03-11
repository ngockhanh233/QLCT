import Svg, { Path } from 'react-native-svg';

type Props = {
  width?: number;
  height?: number;
  color?: string;
};

const ChevronLeftIcon = ({ width = 20, height = 20, color = '#000' }: Props) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M15 18l-6-6 6-6"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default ChevronLeftIcon;

