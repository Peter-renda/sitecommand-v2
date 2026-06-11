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
import { getSubmittal } from '../../../../../lib/api';
import { LoadingSpinner } from '../../../../../components/ui/LoadingSpinner';
import { submittalStatusBadge } from '../../../../../components/ui/Badge';
import { Colors } from '../../../../../constants/colors';
import type { Submittal } from '../../../../../types';

export default function SubmittalDetailScreen() {
  const { id: projectId, submittalId } = useLocalSearchParams<{ id: string; submittalId: string }>();
  const [submittal, setSubmittal] = useState<Submittal | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const data = await getSubmittal(projectId, submittalId);
      setSubmittal(data);
    } catch {
      Alert.alert('Error', 'Failed to load submittal.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingSpinner />;
  if (!submittal) {
    return (
      <View style={styles.root}>
        <Text style={{ color: Colors.text, padding: 16 }}>Submittal not found.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `Submittal #${submittal.submittal_number}` }} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.number}>
              #{submittal.submittal_number}
              {submittal.revision && ` Rev ${submittal.revision}`}
            </Text>
            {submittalStatusBadge(submittal.status)}
          </View>
        </View>

        <Text style={styles.title}>{submittal.title}</Text>

        {/* Meta chips */}
        <View style={styles.chipRow}>
          {submittal.type && (
            <Chip icon="document-outline" label={submittal.type} />
          )}
          {submittal.final_due_date && (
            <Chip icon="calendar-outline" label={`Due ${new Date(submittal.final_due_date).toLocaleDateString()}`} />
          )}
          {submittal.received_date && (
            <Chip icon="arrow-down-circle-outline" label={`Received ${new Date(submittal.received_date).toLocaleDateString()}`} />
          )}
        </View>

        {/* Details */}
        <Section title="Submittal Details">
          <Row label="Number" value={`#${submittal.submittal_number}${submittal.revision ? ` Rev ${submittal.revision}` : ''}`} />
          <Row label="Status" value={submittal.status.replace(/_/g, ' ')} />
          {submittal.type && <Row label="Type" value={submittal.type} />}
          {submittal.submit_by && <Row label="Submit By" value={new Date(submittal.submit_by).toLocaleDateString()} />}
          {submittal.received_date && <Row label="Received" value={new Date(submittal.received_date).toLocaleDateString()} />}
          {submittal.final_due_date && <Row label="Due Date" value={new Date(submittal.final_due_date).toLocaleDateString()} />}
          {submittal.issue_date && <Row label="Issue Date" value={new Date(submittal.issue_date).toLocaleDateString()} />}
          <Row label="Created" value={new Date(submittal.created_at).toLocaleDateString()} />
        </Section>

        {submittal.description && (
          <Section title="Description">
            <Text style={styles.bodyText}>{submittal.description}</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  number: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
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
  rowValue: { color: Colors.text, fontSize: 13, fontWeight: '500', flex: 2, textAlign: 'right' },
  bodyText: { color: Colors.text, fontSize: 14, lineHeight: 21 },
});
