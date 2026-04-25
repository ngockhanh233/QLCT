import Svg, { Path, Rect } from 'react-native-svg';

/** Bao lì xì với mũi tên lên (tiền ra). */
export default ({ width = 24, height = 24, color = '#000' }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Rect
      x={4.5}
      y={5}
      width={15}
      height={14}
      rx={1.8}
      stroke={color}
      strokeWidth={1.8}
      fill="none"
    />
    <Path
      d="M12 8.5l.6 1.3 1.4.2-1 1 .2 1.4-1.2-.7-1.2.7.2-1.4-1-1 1.4-.2L12 8.5z"
      fill={color}
    />
    {/* Mũi tên lên (chi ra) nhỏ góc phải */}
    <Path
      d="M17 17v-3m0 0l-1 1m1-1l1 1"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
