import Svg, { Path } from 'react-native-svg';

/** Phong bì với trái tim — tiền mừng hiếu hỉ (nhận). */
export default ({ width = 24, height = 24, color = '#000' }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v9A1.5 1.5 0 0 1 19.5 18h-15A1.5 1.5 0 0 1 3 16.5v-9z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
    {/* Nắp phong bì */}
    <Path
      d="M3 7.5l9 5.5 9-5.5"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Trái tim nhỏ trên phong bì */}
    <Path
      d="M12 11c-.6-.8-2-.8-2.5.2-.4.9.6 1.8 2.5 2.8 1.9-1 2.9-1.9 2.5-2.8-.5-1-1.9-1-2.5-.2z"
      fill={color}
    />
  </Svg>
);
