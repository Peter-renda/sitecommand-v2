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
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getRFIs } from '../../../../../lib/api';
import { LoadingSpinner } from '../../../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../../../components/ui/EmptyState';
import { rfiStatusBadge } from '../../../../../components/ui/Badge';
import { Colors } from '../../../../../constants/colors';
import type { RFI } from '../../../../../types';

type FilterStatus = 'all' | 'open' | 'draft' | 'closed';

export default function RFIsScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const [rfis, setRFIs] = useState<RFI[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getRFIs(projectId);
      setRFIs(data);
    } catch {
      Alert.alert('Error', 'Failed to load RFIs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? rfis : rfis.filter((r) => r.status === filter);

  const counts = {
    all: rfis.length,
    open: rfis.filter((r) => r.status === 'open').length,
    draft: rfis.filter((r) => r.status === 'draft').length,
    closed: rfis.filter((r) => r.status === 'closed').length,
  };

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'RFIs',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push(`/(app)/projects/${projectId}/rfis/new`)}
              style={{ marginRight: 4 }}
            >
              <Ionicons name="add-circle-outline" size={26} color={Colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={styles.root}>
        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          {(['all', 'open', 'draft', 'closed'] as FilterStatus[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterLabel, filter === f && styles.filterLabelActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
          }
          renderItem={({ item: rfi }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(app)/projects/${projectId}/rfis/${rfi.id}`)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.rfiNumber}>RFI #{rfi.rfi_number}</Text>
                {rfiStatusBadge(rfi.status)}
              </View>
              <Text style={styles.subject} numberOfLines={2}>{rfi.subject}</Text>
              <View style={styles.cardMeta}>
                {rfi.due_date && (
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>Due {new Date(rfi.due_date).toLocaleDateString()}</Text>
                  </View>
                )}
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.metaText}>{new Date(rfi.created_at).toLocaleDateString()}</Text>
                </View>
                {rfi.attachments?.length > 0 && (
                  <View style={styles.metaItem}>
                    <Ionicons name="attach-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{rfi.attachments.length}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <EmptyState
              title="No RFIs"
              message={filter !== 'all' ? `No ${filter} RFIs.` : 'No RFIs have been created for this project.'}
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
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  filterTabActive: { backgroundColor: Colors.primary + '22' },
  filterLabel: { color: Colors.textMuted, fontSize: 13, fontWeight: '500' },
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
  rfiNumber: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  subject: { color: Colors.text, fontSize: 15, fontWeight: '500', lineHeight: 20 },
  cardMeta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: Colors.textMuted, fontSize: 12 },
});
