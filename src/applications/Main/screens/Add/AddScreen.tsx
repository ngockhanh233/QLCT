import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const AddScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Thêm giao dịch</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  },
});

export default AddScreen;
