import Svg, { Path } from 'react-native-svg';

type Props = {
  width?: number;
  height?: number;
  color?: string;
};

const ClothesIcon = ({ width = 24, height = 24, color = '#000' }: Props) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    {/* T-shirt body */}
    <Path
      d="M9 4L7 5.5L5 5L3.5 7.5L6 8.5V19C6 19.8284 6.67157 20.5 7.5 20.5H16.5C17.3284 20.5 18 19.8284 18 19V8.5L20.5 7.5L19 5L17 5.5L15 4H9Z"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    {/* Neckline */}
    <Path
      d="M10 5.5C10.5 6.3 11.2 6.8 12 6.8C12.8 6.8 13.5 6.3 14 5.5"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
    />
  </Svg>
);

export default ClothesIcon;

