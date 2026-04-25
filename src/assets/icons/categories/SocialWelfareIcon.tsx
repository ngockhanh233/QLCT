import Svg, { Path, Circle } from 'react-native-svg';

export default ({ width = 24, height = 24, color = '#000' }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    {/* Bàn tay đỡ (palm) + trái tim/biểu tượng hỗ trợ */}
    <Path
      d="M4 14v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M7 14v-2a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v2"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M12 8.5c-.8-1-2.5-1-3 0-.6 1.2.7 2.3 3 3.5 2.3-1.2 3.6-2.3 3-3.5-.5-1-2.2-1-3 0z"
      fill={color}
    />
    <Circle cx={12} cy={4.5} r={1.2} fill={color} />
  </Svg>
);
