import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  type ViewStyle,
} from 'react-native';
import { colors } from '../../utils/color';
import { getFundIconComponent } from '../../constants/FundIconConstants';
import { useBalanceVisibility } from '../../contexts/BalanceVisibilityContext';
import type { FundRecord } from '../../types/fund';

export type FundPickerLayout = 'horizontal' | 'grid';

export interface FundPickerProps {
  funds: FundRecord[];
  selectedFundId: string | null | undefined;
  onSelect: (fundId: string) => void;
  /**
   * - 'grid': wrap thành 2 cột (item width 48%) — dùng cho modal/popup
   * - 'horizontal': scroll ngang — dùng cho fund row inline trong screen
   */
  layout?: FundPickerLayout;
  showBalance?: boolean;
  /** Tap vào item disabled sẽ bị bỏ qua (không gọi onSelect). */
  isDisabled?: (fund: FundRecord) => boolean;
  /** Hiển thị 1 dòng nhỏ màu đỏ dưới balance khi item disabled. */
  disabledReason?: (fund: FundRecord) => string | undefined;
  emptyText?: string;
  /** Wrapper style override (gắn vào container ngoài cùng). */
  containerStyle?: ViewStyle;
}

const FundPicker: React.FC<FundPickerProps> = ({
  funds,
  selectedFundId,
  onSelect,
  layout = 'grid',
  showBalance = true,
  isDisabled,
  disabledReason,
  emptyText = 'Không có quỹ phù hợp',
  containerStyle,
}) => {
  const { maskAmount } = useBalanceVisibility();

  if (funds.length === 0) {
    return <Text style={styles.empty}>{emptyText}</Text>;
  }

  const renderItem = (fund: FundRecord) => {
    const isSelected = selectedFundId === fund.id;
    const fundColor = fund.color ?? colors.primary;
    const disabled = isDisabled?.(fund) ?? false;
    const reason = disabled ? disabledReason?.(fund) : undefined;
    const FundIcon = getFundIconComponent(fund.icon);

    return (
      <TouchableOpacity
        key={fund.id}
        style={[
          layout === 'grid' ? styles.gridItem : styles.horizontalItem,
          isSelected && {
            borderColor: fundColor,
            backgroundColor: fundColor + '10',
          },
          disabled && { opacity: 0.45 },
        ]}
        onPress={() => {
          if (disabled) return;
          onSelect(fund.id);
        }}
        disabled={disabled}
        activeOpacity={0.75}
      >
        <View style={[styles.iconCircle, { backgroundColor: fundColor + '20' }]}>
          <FundIcon width={18} height={18} color={fundColor} />
        </View>
        <View style={styles.textCol}>
          <Text
            style={[
              styles.name,
              isSelected && { color: fundColor, fontWeight: '800' },
            ]}
            numberOfLines={1}
          >
            {fund.name}
          </Text>
          {showBalance && (
            <Text style={styles.balance} numberOfLines={1}>
              {maskAmount(fund.balance ?? 0)}
            </Text>
          )}
          {reason ? <Text style={styles.reason}>{reason}</Text> : null}
        </View>
      </TouchableOpacity>
    );
  };

  if (layout === 'horizontal') {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.horizontalContainer, containerStyle]}
      >
        {funds.map(renderItem)}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.gridContainer, containerStyle]}>
      {funds.map(renderItem)}
    </View>
  );
};

const styles = StyleSheet.create({
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 4,
  },
  gridItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.white,
  },
  horizontalContainer: {
    gap: 10,
    paddingVertical: 4,
    paddingRight: 4,
  },
  horizontalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.white,
    minWidth: 170,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textCol: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  balance: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },
  reason: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    color: colors.error,
  },
  empty: {
    paddingVertical: 14,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default FundPicker;
