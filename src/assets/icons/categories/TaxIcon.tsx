import Svg, { Path, Circle } from 'react-native-svg';

/** Tờ khai thuế — mảnh giấy với % bên trên. */
export default ({ width = 24, height = 24, color = '#000' }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
    <Path
      d="M14 3v4h4"
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
    />
    {/* Ký hiệu % */}
    <Circle cx={10} cy={12.5} r={1.3} stroke={color} strokeWidth={1.5} />
    <Circle cx={14.5} cy={17} r={1.3} stroke={color} strokeWidth={1.5} />
    <Path
      d="M15.5 11l-6 7"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
    />
  </Svg>
);
