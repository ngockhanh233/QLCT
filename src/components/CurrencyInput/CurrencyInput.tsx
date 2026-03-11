import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { colors } from '../../utils/color';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  label?: string;
  suffix?: string;
  containerStyle?: ViewStyle;
  inputWrapperStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  suffixStyle?: TextStyle;
  showSuggestions?: boolean;
  editable?: boolean;
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  placeholder = '0',
  label,
  suffix = 'đ',
  containerStyle,
  inputWrapperStyle,
  inputStyle,
  labelStyle,
  suffixStyle,
  showSuggestions = true,
  editable = true,
}) => {
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (value > 0) {
      setDisplayValue(formatNumber(value));
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const formatNumber = (num: number): string => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const handleChangeText = (text: string) => {
    const numericOnly = text.replace(/[^0-9]/g, '');
    
    if (numericOnly === '') {
      setDisplayValue('');
      onChange(0);
      return;
    }

    const numericValue = parseInt(numericOnly, 10);
    const formatted = formatNumber(numericValue);
    
    setDisplayValue(formatted);
    onChange(numericValue);
  };

  const suggestions = useMemo(() => {
    if (!displayValue || !isFocused) return [];
    
    const numericOnly = displayValue.replace(/[^0-9]/g, '');
    if (!numericOnly || numericOnly === '0') return [];
    
    const baseNum = parseInt(numericOnly, 10);
    const suggestionValues: number[] = [];
    
    // Generate suggestions: x1000, x10000, x100000, x1000000
    const multipliers = [1000, 10000, 100000, 1000000];
    
    multipliers.forEach(multiplier => {
      const suggestion = baseNum * multiplier;
      if (suggestion <= 999999999 && suggestion !== baseNum) {
        suggestionValues.push(suggestion);
      }
    });

    // Remove duplicates and sort
    return [...new Set(suggestionValues)].slice(0, 4);
  }, [displayValue, isFocused]);

  const handleSelectSuggestion = (suggestionValue: number) => {
    setDisplayValue(formatNumber(suggestionValue));
    onChange(suggestionValue);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, labelStyle]}>{label}</Text>}
      
      <View style={[styles.inputWrapper, !editable && styles.inputWrapperDisabled, inputWrapperStyle]}>
        <TextInput
          style={[styles.input, inputStyle]}
          placeholder={placeholder}
          placeholderTextColor={colors.textLight}
          keyboardType="numeric"
          value={displayValue}
          onChangeText={handleChangeText}
          editable={editable}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
        />
        <Text style={[styles.suffix, suffixStyle]}>{suffix}</Text>
      </View>

      {showSuggestions && suggestions.length > 0 && isFocused && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.suggestionsContainer}
          contentContainerStyle={styles.suggestionsContent}
          keyboardShouldPersistTaps="always"
        >
          {suggestions.map((suggestion) => (
            <TouchableOpacity
              key={suggestion}
              style={styles.suggestionItem}
              onPress={() => handleSelectSuggestion(suggestion)}
              activeOpacity={0.7}
            >
              <Text style={styles.suggestionText}>
                {formatNumber(suggestion)}đ
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
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
    marginBottom: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  inputWrapperDisabled: {
    opacity: 0.6,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  suffix: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: 4,
  },
  suggestionsContainer: {
    marginTop: 10,
    maxHeight: 40,
  },
  suggestionsContent: {
    gap: 8,
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.primary + '15',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});

export default CurrencyInput;
