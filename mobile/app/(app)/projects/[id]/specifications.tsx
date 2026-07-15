import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getSpecifications } from '../../../../lib/api';
import { LoadingSpinner } from '../../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { Colors } from '../../../../constants/colors';
import type { Specification } from '../../../../types';

export default function SpecificationsScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const [specs, setSpecs] = useState<Specification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getSpecifications(projectId);
      setSpecs(data);
    } catch {
      Alert.alert('Error', 'Failed to load specifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? specs.filter((s) => {
        const q = search.toLowerCase();
        return (
          s.title.toLowerCase().includes(q) ||
          s.spec_number?.toLowerCase().includes(q)
        );
      })
    : specs;

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <Stack.Screen options={{ title: 'Specifications' }} />
      <View style={styles.root}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search specifications…"
            placeholderTextColor={Colors.textSubtle}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={{ marginRight: 12 }}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(s) => s.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
          }
          renderItem={({ item: spec }) => {
            const isExpanded = expanded === spec.id;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => setExpanded(isExpanded ? null : spec.id)}
                activeOpacity={0.8}
              >
                <View style={styles.cardRow}>
                  <View style={styles.cardLeft}>
                    {spec.spec_number && (
                      <Text style={styles.specNumber}>{spec.spec_number}</Text>
                    )}
                    <Text style={styles.specTitle} numberOfLines={isExpanded ? undefined : 2}>
                      {spec.title}
                    </Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={Colors.textMuted}
                  />
                </View>
                {isExpanded && spec.description && (
                  <Text style={styles.description}>{spec.description}</Text>
                )}
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <EmptyState
              title="No Specifications"
              message={search ? 'No specs match your search.' : 'No specifications have been added to this project.'}
            />
          }
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    color: Colors.text,
    fontSize: 15,
  },
  list: { padding: 16, flexGrow: 1 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardLeft: { flex: 1 },
  specNumber: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  specTitle: { color: Colors.text, fontSize: 15, fontWeight: '500', lineHeight: 20 },
  description: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
});
