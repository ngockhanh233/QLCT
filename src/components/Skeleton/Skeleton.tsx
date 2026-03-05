import React from 'react';
import { View, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import { colors } from '../../utils/color';

type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle | ViewStyle[];
};

const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  radius = 8,
  style,
}) => {
  return (
    <View
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius: radius,
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.backgroundSecondary,
  },
});

export default Skeleton;

