import Svg, { Path, Circle } from 'react-native-svg';

// Xe moto — Tabler Icons motorbike style.
export default ({ width = 24, height = 24, color = '#000' }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    {/* Bánh trước */}
    <Circle cx={5} cy={16} r={3} stroke={color} strokeWidth={1.7} />
    {/* Bánh sau */}
    <Circle cx={19} cy={16} r={3} stroke={color} strokeWidth={1.7} />
    {/* Bình xăng + yên */}
    <Path
      d="M7.5 14h5l4-4h-10.5l1.5 4z"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Tay lái */}
    <Path
      d="M13 6h2l1.5 3h-5z"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Phuộc trước */}
    <Path
      d="M2 10h3l1.5 4"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
