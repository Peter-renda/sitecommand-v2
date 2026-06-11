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
  Linking,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDrawings } from '../../../../lib/api';
import { LoadingSpinner } from '../../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { Colors } from '../../../../constants/colors';
import type { Drawing } from '../../../../types';

export default function DrawingsScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>();
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getDrawings(projectId);
      setDrawings(data.drawings ?? []);
    } catch {
      Alert.alert('Error', 'Failed to load drawings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? drawings.filter((d) => {
        const q = search.toLowerCase();
        return (
          d.filename?.toLowerCase().includes(q) ||
          d.drawing_no?.toLowerCase().includes(q) ||
          d.title?.toLowerCase().includes(q)
        );
      })
    : drawings;

  function openDrawing(drawing: Drawing) {
    if (!drawing.storage_path) {
      Alert.alert('Not Available', 'No file available for this drawing.');
      return;
    }
    Alert.alert(
      drawing.drawing_no ?? drawing.filename,
      'Open this drawing?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open', onPress: () => Linking.openURL(drawing.storage_path) },
      ],
    );
  }

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <Stack.Screen options={{ title: 'Drawings' }} />
      <View style={styles.root}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search drawings…"
            placeholderTextColor={Colors.textSubtle}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={{ marginRight: 12 }}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(d) => d.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.primary} />
          }
          renderItem={({ item: drawing }) => (
            <TouchableOpacity style={styles.card} onPress={() => openDrawing(drawing)}>
              <View style={styles.cardLeft}>
                <View style={styles.iconWrap}>
                  <Ionicons name="document-outline" size={22} color={Colors.primary} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.drawingNo} numberOfLines={1}>
                    {drawing.drawing_no ?? `Page ${drawing.page_number}`}
                  </Text>
                  {drawing.title && (
                    <Text style={styles.drawingTitle} numberOfLines={1}>{drawing.title}</Text>
                  )}
                  <View style={styles.meta}>
                    {drawing.revision && (
                      <Text style={styles.metaText}>Rev {drawing.revision}</Text>
                    )}
                    {drawing.drawing_date && (
                      <View style={styles.metaItem}>
                        <Ionicons name="calendar-outline" size={11} color={Colors.textMuted} />
                        <Text style={styles.metaText}>{new Date(drawing.drawing_date).toLocaleDateString()}</Text>
                      </View>
                    )}
                    {drawing.uploaded_by_name && (
                      <View style={styles.metaItem}>
                        <Ionicons name="person-outline" size={11} color={Colors.textMuted} />
                        <Text style={styles.metaText}>{drawing.uploaded_by_name}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              <Ionicons name="open-outline" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <EmptyState
              title="No Drawings"
              message={search ? 'No drawings match your search.' : 'No drawings have been uploaded for this project.'}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1 },
  drawingNo: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  drawingTitle: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
  meta: { flexDirection: 'row', gap: 10, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { color: Colors.textMuted, fontSize: 11 },
});
