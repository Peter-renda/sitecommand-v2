import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getTransmittal } from '../../../../../lib/api';
import { LoadingSpinner } from '../../../../../components/ui/LoadingSpinner';
import { Badge } from '../../../../../components/ui/Badge';
import { Colors } from '../../../../../constants/colors';
import type { Transmittal } from '../../../../../types';

function statusColor(status: string): 'gray' | 'blue' | 'green' {
  const map: Record<string, 'gray' | 'blue' | 'green'> = {
    draft: 'gray', sent: 'blue', received: 'green', approved: 'green',
  };
  return map[status.toLowerCase()] ?? 'gray';
}

export default function TransmittalDetailScreen() {
  const { id: projectId, transmittalId } = useLocalSearchParams<{ id: string; transmittalId: string }>();
  const [transmittal, setTransmittal] = useState<Transmittal | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const data = await getTransmittal(projectId, transmittalId);
      setTransmittal(data);
    } catch {
      Alert.alert('Error', 'Failed to load transmittal.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingSpinner />;
  if (!transmittal) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <Text style={{ color: Colors.text, padding: 16 }}>Transmittal not found.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `T-${transmittal.transmittal_number}` }} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.number}>T-{transmittal.transmittal_number}</Text>
          <Badge
            label={transmittal.status.charAt(0).toUpperCase() + transmittal.status.slice(1)}
            color={statusColor(transmittal.status)}
          />
        </View>

        {transmittal.subject && <Text style={styles.subject}>{transmittal.subject}</Text>}

        <View style={styles.chipRow}>
          {transmittal.sent_date && (
            <Chip icon="send-outline" label={`Sent ${new Date(transmittal.sent_date).toLocaleDateString()}`} />
          )}
          {transmittal.due_by && (
            <Chip icon="calendar-outline" label={`Due ${new Date(transmittal.due_by).toLocaleDateString()}`} />
          )}
          {transmittal.sent_via && <Chip icon="mail-outline" label={transmittal.sent_via} />}
        </View>

        <Section title="Details">
          {transmittal.to_name && <Row label="To" value={transmittal.to_name} />}
          {transmittal.sent_via && <Row label="Sent Via" value={transmittal.sent_via} />}
          {transmittal.sent_date && <Row label="Sent Date" value={new Date(transmittal.sent_date).toLocaleDateString()} />}
          {transmittal.due_by && <Row label="Due By" value={new Date(transmittal.due_by).toLocaleDateString()} />}
          <Row label="Privacy" value={transmittal.private ? 'Private' : 'Public'} />
        </Section>

        {transmittal.items && transmittal.items.length > 0 && (
          <Section title={`Items (${transmittal.items.length})`}>
            {transmittal.items.map((item, i) => (
              <View key={i} style={styles.itemRow}>
                <View style={styles.itemLeft}>
                  <Ionicons name="document-outline" size={16} color={Colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemDescription}>{item.description}</Text>
                    {item.type && <Text style={styles.itemMeta}>{item.type}{item.action ? ` · ${item.action}` : ''}</Text>}
                  </View>
                </View>
                {item.quantity != null && (
                  <Text style={styles.itemQty}>×{item.quantity}</Text>
                )}
              </View>
            ))}
          </Section>
        )}

        {transmittal.comments && (
          <Section title="Comments">
            <Text style={styles.bodyText}>{transmittal.comments}</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  number: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  subject: { color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 12, lineHeight: 26 },
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
  rowValue: { color: Colors.text, fontSize: 13, fontWeight: '500', flex: 2, textAlign: 'right' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  itemLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  itemDescription: { color: Colors.text, fontSize: 13, fontWeight: '500' },
  itemMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  itemQty: { color: Colors.textMuted, fontSize: 13 },
  bodyText: { color: Colors.text, fontSize: 14, lineHeight: 21 },
});
