import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';

export const NewslettersScreen: React.FC = () => {
  // TODO: Replace with actual data fetching
  const newsletters = [];

  return (
    <View style={styles.container}>
      {newsletters.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No newsletters yet</Text>
          <Text style={styles.emptySubtext}>Your subscribed newsletters will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={newsletters}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.newsletterItem}>
              <Text style={styles.newsletterTitle}>{item.title}</Text>
              <Text style={styles.newsletterSource}>{item.source}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  newsletterItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  newsletterTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  newsletterSource: {
    fontSize: 14,
    color: '#666',
  },
});

export default NewslettersScreen;
