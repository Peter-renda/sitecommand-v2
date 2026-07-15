import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getPunchListItem, updatePunchListItem } from '../../../../../lib/api';
import { LoadingSpinner } from '../../../../../components/ui/LoadingSpinner';
import { punchStatusBadge, priorityBadge } from '../../../../../components/ui/Badge';
import { Colors } from '../../../../../constants/colors';
import type { PunchListItem, PunchListStatus } from '../../../../../types';

const STATUS_OPTIONS: { value: PunchListStatus; label: string }[] = [
  { value: 'initiated', label: 'Initiated' },
  { value: 'ready_for_review', label: 'Ready for Review' },
  { value: 'not_accepted', label: 'Not Accepted' },
  { value: 'complete', label: 'Complete' },
];

export default function PunchListItemScreen() {
  const { id: projectId, itemId } = useLocalSearchParams<{ id: string; itemId: string }>();
  const [item, setItem] = useState<PunchListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  async function load() {
    try {
      const data = await getPunchListItem(projectId, itemId);
      setItem(data);
    } catch {
      Alert.alert('Error', 'Failed to load punch list item.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  function handleChangeStatus() {
    Alert.alert(
      'Change Status',
      'Select a new status:',
      [
        ...STATUS_OPTIONS.map((opt) => ({
          text: opt.label,
          onPress: () => applyStatus(opt.value),
        })),
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  async function applyStatus(status: PunchListStatus) {
    if (!item || status === item.status) return;
    setUpdatingStatus(true);
    try {
      const updated = await updatePunchListItem(projectId, itemId, { status });
      setItem(updated);
    } catch {
      Alert.alert('Error', 'Failed to update status.');
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (!item) {
    return (
      <View style={styles.root}>
        <Text style={{ color: Colors.text, padding: 16 }}>Item not found.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `Punch #${item.item_number}` }} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.badges}>
            <Text style={styles.itemNumber}>#{item.item_number}</Text>
            {punchStatusBadge(item.status)}
            {priorityBadge(item.priority)}
          </View>
          <TouchableOpacity
            onPress={handleChangeStatus}
            style={styles.statusBtn}
            disabled={updatingStatus}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color={Colors.primary} />
            <Text style={styles.statusBtnText}>Change Status</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>{item.title}</Text>

        {/* Location/Trade chips */}
        <View style={styles.chipRow}>
          {item.location && <Chip icon="location-outline" label={item.location} />}
          {item.trade && <Chip icon="construct-outline" label={item.trade} />}
          {item.due_date && <Chip icon="calendar-outline" label={`Due ${new Date(item.due_date).toLocaleDateString()}`} />}
        </View>

        {/* Details */}
        <Section title="Details">
          <Row label="Status" value={item.status.replace(/_/g, ' ')} />
          {item.priority && <Row label="Priority" value={item.priority.charAt(0).toUpperCase() + item.priority.slice(1)} />}
          {item.type && <Row label="Type" value={item.type} />}
          {item.location && <Row label="Location" value={item.location} />}
          {item.trade && <Row label="Trade" value={item.trade} />}
          {item.reference && <Row label="Reference" value={item.reference} />}
          {item.due_date && <Row label="Due Date" value={new Date(item.due_date).toLocaleDateString()} />}
          <Row label="Created" value={new Date(item.created_at).toLocaleDateString()} />
        </Section>

        {item.description && (
          <Section title="Description">
            <Text style={styles.bodyText}>{item.description}</Text>
          </Section>
        )}
      </ScrollView>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Chip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={13} color={Colors.textMuted} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  itemNumber: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary + '22',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  statusBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  title: { color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 12, lineHeight: 26 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipText: { color: Colors.textMuted, fontSize: 12 },
  section: { marginBottom: 20 },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionBody: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowLabel: { color: Colors.textMuted, fontSize: 13, flex: 1 },
  rowValue: { color: Colors.text, fontSize: 13, fontWeight: '500', flex: 2, textAlign: 'right', textTransform: 'capitalize' },
  bodyText: { color: Colors.text, fontSize: 14, lineHeight: 21 },
});
