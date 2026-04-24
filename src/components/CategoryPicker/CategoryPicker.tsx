import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../utils/color';
import ChevronDownIcon from '../../assets/icons/ChevronDownIcon';

export interface CategoryIconProps {
  width?: number;
  height?: number;
  color?: string;
}

export interface CategoryPickerItem {
  id: string;
  name: string;
  icon: React.FC<CategoryIconProps>;
  color: string;
}

interface CategoryPickerProps {
  categories: CategoryPickerItem[];
  value: string;
  onChange: (id: string) => void;
  /** Khi true, bấm lại danh mục đang chọn sẽ bỏ chọn (value = ''). Mặc định false. */
  allowDeselect?: boolean;
  label?: string;
  /** Số item hiển thị mặc định khi chưa expand. Nếu tổng <= số này thì không có nút Xem thêm. */
  collapsedCount?: number;
  /** Trạng thái expand khởi tạo. Khi parent đổi giá trị (vd: mở modal với preset mới) internal state sẽ sync lại. */
  initialShowAll?: boolean;
}

const DEFAULT_COLLAPSED = 5;

const CategoryPicker: React.FC<CategoryPickerProps> = ({
  categories,
  value,
  onChange,
  allowDeselect = false,
  label,
  collapsedCount = DEFAULT_COLLAPSED,
  initialShowAll,
}) => {
  const [showAll, setShowAll] = useState(initialShowAll ?? false);
  const hasToggle = categories.length > collapsedCount + 1;

  // Parent đổi initialShowAll → sync internal state (vd: mở modal edit với preset có
  // category nằm ngoài nhóm hiển thị mặc định, muốn grid tự expand sẵn).
  useEffect(() => {
    if (initialShowAll === undefined) return;
    setShowAll(initialShowAll);
  }, [initialShowAll]);

  const visible = useMemo(() => {
    if (!hasToggle) return categories;
    return showAll ? categories : categories.slice(0, collapsedCount);
  }, [categories, showAll, collapsedCount, hasToggle]);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.grid}>
        {visible.map((cat) => {
          const IconComponent = cat.icon;
          const isSelected = value === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.item,
                isSelected && styles.itemActive,
                isSelected && { borderColor: cat.color },
              ]}
              onPress={() => {
                if (allowDeselect && isSelected) {
                  onChange('');
                } else {
                  onChange(cat.id);
                }
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.iconWrap, { backgroundColor: cat.color + '15' }]}>
                <IconComponent width={22} height={22} color={cat.color} />
              </View>
              <Text
                style={[styles.text, isSelected && { color: cat.color }]}
                numberOfLines={2}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}

        {hasToggle && !showAll && (
          <TouchableOpacity
            style={[styles.item, styles.moreItem]}
            onPress={() => setShowAll(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconWrap, styles.moreIcon]}>
              <ChevronDownIcon width={20} height={20} color={colors.primary} />
            </View>
            <Text style={[styles.text, styles.moreText]} numberOfLines={2}>
              Xem thêm
            </Text>
          </TouchableOpacity>
        )}

        {hasToggle && showAll && (
          <TouchableOpacity
            style={[styles.item, styles.moreItem]}
            onPress={() => setShowAll(false)}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.iconWrap,
                styles.moreIcon,
                { transform: [{ rotate: '180deg' }] },
              ]}
            >
              <ChevronDownIcon width={20} height={20} color={colors.primary} />
            </View>
            <Text style={[styles.text, styles.moreText]} numberOfLines={2}>
              Thu gọn
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  item: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: 'transparent',
    width: '31%',
    marginBottom: 12,
    minHeight: 92,
  },
  itemActive: {
    borderWidth: 2,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  moreItem: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.primary + '25',
    borderStyle: 'dashed',
  },
  moreIcon: {
    backgroundColor: colors.primary + '14',
  },
  moreText: {
    color: colors.primary,
    fontWeight: '800',
  },
});

export default CategoryPicker;
