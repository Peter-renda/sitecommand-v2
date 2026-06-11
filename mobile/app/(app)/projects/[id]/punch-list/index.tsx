import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getPunchList } from '../../../../../lib/api';
import { LoadingSpinner } from '../../../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../../../components/ui/EmptyState';
import { punchStatusBadge, priorityBadge } from '../../../../../components/ui/Badge';
import { Colors } from '../../../../../constants/colors';
import type { PunchListItem, PunchListStatus } from '../../../../../types';

type Filter = 'all' | PunchListStatus;

export default function PunchListScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const [items, setItems] = useState<PunchListItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getPunchList(projectId);
      setItems(data);
    } catch {
      Alert.alert('Error', 'Failed to load punch list.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? items : items.filter((i) => i.status === filter);

  const counts = {
    all: items.length,
    initiated: items.filter((i) => i.status === 'initiated').length,
    ready_for_review: items.filter((i) => i.status === 'ready_for_review').length,
    not_accepted: items.filter((i) => i.status === 'not_accepted').length,
    complete: items.filter((i) => i.status === 'complete').length,
  };

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Punch List',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push(`/(app)/projects/${projectId}/punch-list/new`)}
              style={{ marginRight: 4 }}
            >
              <Ionicons name="add-circle-outline" size={26} color={Colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={styles.root}>
        <View style={styles.filterRow}>
          {(['all', 'initiated', 'ready_for_review', 'not_accepted', 'complete'] as Filter[]).map((f) => {
            const label = f === 'all' ? 'All' : f === 'ready_for_review' ? 'Review' : f === 'not_accepted' ? 'Rejected' : f.charAt(0).toUpperCase() + f.slice(1);
            return (
              <TouchableOpacity
                key={f}
                style={[styles.filterTab, filter === f && styles.filterTabActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterLabel, filter === f && styles.filterLabelActive]}>
                  {label} ({counts[f as keyof typeof counts] ?? filtered.length})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(app)/projects/${projectId}/punch-list/${item.id}`)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.itemNumber}>#{item.item_number}</Text>
                <View style={styles.badges}>
                  {punchStatusBadge(item.status)}
                  {priorityBadge(item.priority)}
                </View>
              </View>
              <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
              <View style={styles.meta}>
                {item.location && (
                  <View style={styles.metaItem}>
                    <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{item.location}</Text>
                  </View>
                )}
                {item.trade && (
                  <View style={styles.metaItem}>
                    <Ionicons name="construct-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{item.trade}</Text>
                  </View>
                )}
                {item.due_date && (
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>Due {new Date(item.due_date).toLocaleDateString()}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <EmptyState
              title="No Items"
              message={filter !== 'all' ? `No ${filter.replace('_', ' ')} punch list items.` : 'No punch list items yet.'}
            />
          }
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    flexWrap: 'wrap',
  },
  filterTab: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, backgroundColor: Colors.background },
  filterTabActive: { backgroundColor: Colors.primary + '22' },
  filterLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: '500' },
  filterLabelActive: { color: Colors.primary, fontWeight: '600' },
  list: { padding: 16, flexGrow: 1 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemNumber: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  badges: { flexDirection: 'row', gap: 6 },
  itemTitle: { color: Colors.text, fontSize: 15, fontWeight: '500', lineHeight: 20 },
  meta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: Colors.textMuted, fontSize: 12 },
});
