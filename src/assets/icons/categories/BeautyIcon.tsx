import Svg, { Path, Circle } from 'react-native-svg';

/** Son môi + gương (đại diện làm đẹp / salon). */
export default ({ width = 24, height = 24, color = '#000' }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    {/* Thân son */}
    <Path
      d="M9 9h6v10a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V9z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
    {/* Đầu son (nghiêng) */}
    <Path
      d="M9 9l2-5h2l2 5"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Vạch ngang chia giữa */}
    <Path
      d="M9 13h6"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
    {/* Hình tròn nhỏ (gương/ngọc trang sức) */}
    <Circle cx={18} cy={5.5} r={2} stroke={color} strokeWidth={1.5} />
  </Svg>
);
