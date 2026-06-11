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
import { getSubmittals } from '../../../../../lib/api';
import { LoadingSpinner } from '../../../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../../../components/ui/EmptyState';
import { submittalStatusBadge } from '../../../../../components/ui/Badge';
import { Colors } from '../../../../../constants/colors';
import type { Submittal } from '../../../../../types';

type FilterStatus = 'all' | 'draft' | 'submitted' | 'under_review' | 'approved' | 'revise_resubmit' | 'rejected';

export default function SubmittalsScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const [submittals, setSubmittals] = useState<Submittal[]>([]);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getSubmittals(projectId);
      setSubmittals(data);
    } catch {
      Alert.alert('Error', 'Failed to load submittals.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? submittals : submittals.filter((s) => s.status === filter);

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <Stack.Screen options={{ title: 'Submittals' }} />
      <View style={styles.root}>
        {/* Quick filter row */}
        <View style={styles.filterRow}>
          {(['all', 'submitted', 'under_review', 'approved', 'revise_resubmit'] as FilterStatus[]).map((f) => {
            const label = f === 'all' ? 'All' : f === 'under_review' ? 'In Review' : f === 'revise_resubmit' ? 'Revise' : f.charAt(0).toUpperCase() + f.slice(1);
            const count = f === 'all' ? submittals.length : submittals.filter((s) => s.status === f).length;
            return (
              <TouchableOpacity
                key={f}
                style={[styles.filterTab, filter === f && styles.filterTabActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterLabel, filter === f && styles.filterLabelActive]}>
                  {label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(s) => s.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
          }
          renderItem={({ item: sub }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(app)/projects/${projectId}/submittals/${sub.id}`)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.number}>
                  #{sub.submittal_number}
                  {sub.revision && ` Rev ${sub.revision}`}
                </Text>
                {submittalStatusBadge(sub.status)}
              </View>
              <Text style={styles.title} numberOfLines={2}>{sub.title}</Text>
              <View style={styles.meta}>
                {sub.type && (
                  <View style={styles.metaItem}>
                    <Ionicons name="document-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{sub.type}</Text>
                  </View>
                )}
                {sub.final_due_date && (
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>Due {new Date(sub.final_due_date).toLocaleDateString()}</Text>
                  </View>
                )}
                {sub.issue_date && (
                  <View style={styles.metaItem}>
                    <Ionicons name="checkmark-outline" size={12} color={Colors.success} />
                    <Text style={[styles.metaText, { color: Colors.success }]}>
                      Issued {new Date(sub.issue_date).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <EmptyState title="No submittals" message={filter !== 'all' ? `No ${filter.replace('_', ' ')} submittals.` : 'No submittals have been created for this project.'} />
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
  filterTab: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
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
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  number: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  title: { color: Colors.text, fontSize: 15, fontWeight: '500', lineHeight: 20 },
  meta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: Colors.textMuted, fontSize: 12 },
});
