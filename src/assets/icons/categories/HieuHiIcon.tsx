import Svg, { Path } from 'react-native-svg';

/** Hai nhẫn cưới lồng nhau — hiếu hỉ (cưới hỏi / ma chay). */
export default ({ width = 24, height = 24, color = '#000' }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    {/* Nhẫn trái */}
    <Path
      d="M9 15.5a4.5 4.5 0 1 1 0-7 4.5 4.5 0 0 1 0 7z"
      stroke={color}
      strokeWidth={1.8}
    />
    {/* Nhẫn phải */}
    <Path
      d="M15 15.5a4.5 4.5 0 1 1 0-7 4.5 4.5 0 0 1 0 7z"
      stroke={color}
      strokeWidth={1.8}
    />
    {/* Điểm kim cương trên nhẫn phải */}
    <Path
      d="M15 6l-1 1.5h2L15 6z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinejoin="round"
      fill={color}
    />
    <Path
      d="M9 6l-1 1.5h2L9 6z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinejoin="round"
      fill={color}
    />
  </Svg>
);
