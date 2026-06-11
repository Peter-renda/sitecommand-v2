import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getProject } from '../../../../lib/api';
import { LoadingSpinner } from '../../../../components/ui/LoadingSpinner';
import { Badge } from '../../../../components/ui/Badge';
import { Colors } from '../../../../constants/colors';
import type { Project } from '../../../../types';

const STATUS_COLOR: Record<string, 'blue' | 'green' | 'yellow' | 'gray' | 'red'> = {
  active: 'green',
  bidding: 'blue',
  planning: 'yellow',
  completed: 'gray',
  on_hold: 'red',
};

type FeatureSection = {
  title: string;
  items: {
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    route: string;
    color: string;
  }[];
};

const FEATURE_SECTIONS: FeatureSection[] = [
  {
    title: 'Field',
    items: [
      { key: 'rfis', label: 'RFIs', icon: 'help-circle-outline', route: 'rfis', color: '#3b82f6' },
      { key: 'submittals', label: 'Submittals', icon: 'document-text-outline', route: 'submittals', color: '#06b6d4' },
      { key: 'punch-list', label: 'Punch List', icon: 'checkmark-done-outline', route: 'punch-list', color: '#ef4444' },
      { key: 'daily-log', label: 'Daily Log', icon: 'journal-outline', route: 'daily-log', color: '#f59e0b' },
      { key: 'photos', label: 'Photos', icon: 'camera-outline', route: 'photos', color: '#ec4899' },
      { key: 'drawings', label: 'Drawings', icon: 'map-outline', route: 'drawings', color: '#8b5cf6' },
    ],
  },
  {
    title: 'Project Management',
    items: [
      { key: 'tasks', label: 'Tasks', icon: 'checkmark-circle-outline', route: 'tasks', color: '#8b5cf6' },
      { key: 'meetings', label: 'Meetings', icon: 'people-circle-outline', route: 'meetings', color: '#06b6d4' },
      { key: 'transmittals', label: 'Transmittals', icon: 'send-outline', route: 'transmittals', color: '#f97316' },
      { key: 'specifications', label: 'Specs', icon: 'book-outline', route: 'specifications', color: '#22c55e' },
      { key: 'directory', label: 'Directory', icon: 'people-outline', route: 'directory', color: '#f97316' },
    ],
  },
  {
    title: 'Financials',
    items: [
      { key: 'budget', label: 'Budget', icon: 'bar-chart-outline', route: 'budget', color: '#22c55e' },
      { key: 'commitments', label: 'Commitments', icon: 'document-attach-outline', route: 'commitments', color: '#f59e0b' },
      { key: 'change-events', label: 'Change Events', icon: 'git-pull-request-outline', route: 'change-events', color: '#f97316' },
      { key: 'change-orders', label: 'Change Orders', icon: 'swap-horizontal-outline', route: 'change-orders', color: '#ef4444' },
    ],
  },
];

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const data = await getProject(id);
      setProject(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  if (loading) return <LoadingSpinner />;
  if (!project) {
    return (
      <View style={styles.root}>
        <Text style={{ color: Colors.text, padding: 24 }}>Project not found.</Text>
      </View>
    );
  }

  const statusColor = STATUS_COLOR[project.status] ?? 'gray';

  return (
    <>
      <Stack.Screen options={{ title: project.name }} />
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
        }
      >
        {/* Project Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.projectName}>{project.name}</Text>
              {project.project_number && (
                <Text style={styles.projectNumber}>Project #{project.project_number}</Text>
              )}
            </View>
            <Badge label={project.status.replace('_', ' ')} color={statusColor} />
          </View>

          <View style={styles.infoGrid}>
            {project.value > 0 && (
              <InfoCell icon="cash-outline" label="Contract Value" value={formatCurrency(project.value)} />
            )}
            {project.address && (
              <InfoCell icon="location-outline" label="Address" value={project.address} />
            )}
            {(project.city || project.state) && (
              <InfoCell
                icon="map-outline"
                label="Location"
                value={[project.city, project.state].filter(Boolean).join(', ')}
              />
            )}
            {project.completion_date && (
              <InfoCell
                icon="calendar-outline"
                label="Completion"
                value={new Date(project.completion_date).toLocaleDateString()}
              />
            )}
            {project.sector && (
              <InfoCell icon="construct-outline" label="Sector" value={project.sector} />
            )}
          </View>

          {project.description && (
            <Text style={styles.description} numberOfLines={3}>{project.description}</Text>
          )}
        </View>

        {/* Feature Sections */}
        {FEATURE_SECTIONS.map((section) => (
          <View key={section.title} style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.featureGrid}>
              {section.items.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={styles.featureCard}
                  onPress={() => router.push(`/(app)/projects/${id}/${f.route}`)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.featureIcon, { backgroundColor: f.color + '22' }]}>
                    <Ionicons name={f.icon} size={22} color={f.color} />
                  </View>
                  <Text style={styles.featureLabel}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </>
  );
}

function InfoCell({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoCell}>
      <View style={styles.infoCellHeader}>
        <Ionicons name={icon} size={13} color={Colors.textMuted} />
        <Text style={styles.infoCellLabel}>{label}</Text>
      </View>
      <Text style={styles.infoCellValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 16, paddingBottom: 32 },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 24,
  },
  infoHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 16 },
  projectName: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  projectNumber: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  infoCell: { minWidth: '45%', flex: 1 },
  infoCellHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  infoCellLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.3 },
  infoCellValue: { color: Colors.text, fontSize: 14, fontWeight: '500' },
  description: { color: Colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 8 },
  sectionBlock: { marginBottom: 20 },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featureCard: {
    width: '30%',
    flex: 1,
    minWidth: 90,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    alignItems: 'center',
    gap: 8,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: { color: Colors.text, fontSize: 12, fontWeight: '500', textAlign: 'center' },
});
