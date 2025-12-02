import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';

const {width} = Dimensions.get('window');

export default function AnimalDetailScreen({route, navigation}) {
  const {animal} = route.params || {};
  const [isFavorite, setIsFavorite] = useState(false);

  // Safety check: if no animal data, go back
  useEffect(() => {
    if (!animal) {
      navigation.goBack();
    }
  }, [animal, navigation]);

  // Early return if no animal (prevents crash)
  if (!animal) {
    return null;
  }

  const handleAdopt = () => {
    Alert.alert(
      'Solicitar Adoção',
      `Deseja solicitar a adoção de ${animal?.name || 'este animal'}?`,
      [
        {text: 'Cancelar', style: 'cancel'},
        {
          text: 'Sim, solicitar',
          onPress: () => {
            Alert.alert(
              'Sucesso!',
              'Solicitação enviada! Entraremos em contato em breve.',
            );
            navigation.goBack();
          },
        },
      ],
    );
  };

  // Merge animal data with defaults, handling missing fields
  const animalData = {
    id: animal?.id || '1',
    name: animal?.name || 'Animal',
    species: animal?.species || 'Cachorro',
    breed: animal?.breed || 'Vira-Lata',
    age: animal?.age || 'N/A',
    gender: animal?.gender || 'Macho',
    size: animal?.size || 'Médio',
    color: animal?.color || 'Não informado',
    vaccinated: animal?.vaccinated || false,
    neutered: animal?.neutered || false,
    description: animal?.description || 'Este animal está procurando um lar cheio de amor!',
    // Handle both 'photo' (singular) and 'photos' (array)
    photos: animal?.photos || (animal?.photo ? [animal.photo] : [
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400',
    ]),
    adoptionDate: animal?.adoptionDate || null,
    rescueDate: animal?.rescueDate || new Date().toISOString().split('T')[0],
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        <View style={styles.imageContainer}>
          <Image
            source={{uri: animalData.photos && animalData.photos.length > 0 ? animalData.photos[0] : 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400'}}
            style={styles.mainImage}
            resizeMode="cover"
            onError={(error) => {
              console.log('Erro ao carregar imagem:', error);
            }}
          />
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={() => setIsFavorite(!isFavorite)}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorite ? '#EC4899' : '#FFFFFF'}
            />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Title Section */}
          <View style={styles.titleSection}>
            <View>
              <Text style={styles.name}>{animalData.name}</Text>
              <Text style={styles.breed}>
                {animalData.breed} • {animalData.age}
              </Text>
            </View>
            <View style={styles.genderBadge}>
              <Ionicons
                name={animalData.gender === 'Macho' ? 'male' : 'female'}
                size={20}
                color={animalData.gender === 'Macho' ? '#3B82F6' : '#EC4899'}
              />
            </View>
          </View>

          {/* Quick Info */}
          <View style={styles.quickInfo}>
            <View style={styles.quickInfoItem}>
              <Ionicons name="resize-outline" size={18} color="#6B7280" />
              <Text style={styles.quickInfoText}>{animalData.size}</Text>
            </View>
            <View style={styles.quickInfoItem}>
              <Ionicons
                name="color-palette-outline"
                size={18}
                color="#6B7280"
              />
              <Text style={styles.quickInfoText}>{animalData.color}</Text>
            </View>
            {animalData.vaccinated && (
              <View style={styles.quickInfoItem}>
                <Ionicons name="shield-checkmark" size={18} color="#10B981" />
                <Text style={[styles.quickInfoText, {color: '#10B981'}]}>
                  Vacinado
                </Text>
              </View>
            )}
            {animalData.neutered && (
              <View style={styles.quickInfoItem}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={[styles.quickInfoText, {color: '#10B981'}]}>
                  Castrado
                </Text>
              </View>
            )}
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sobre {animalData.name}</Text>
            <Text style={styles.description}>{animalData.description}</Text>
          </View>

          {/* Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informações</Text>
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Espécie</Text>
                <Text style={styles.detailValue}>{animalData.species}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Raça</Text>
                <Text style={styles.detailValue}>{animalData.breed}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Idade</Text>
                <Text style={styles.detailValue}>{animalData.age}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Porte</Text>
                <Text style={styles.detailValue}>{animalData.size}</Text>
              </View>
            </View>
          </View>

          {/* Rescue Info */}
          {animalData.rescueDate && (
            <View style={styles.rescueInfo}>
              <Ionicons name="information-circle" size={20} color="#8B5CF6" />
              <Text style={styles.rescueInfoText}>
                Resgatado em{' '}
                {new Date(animalData.rescueDate).toLocaleDateString('pt-BR')}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Adopt Button (Fixed) */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.adoptButton} onPress={handleAdopt}>
          <LinearGradient
            colors={['#8B5CF6', '#7C3AED']}
            style={styles.adoptButtonGradient}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}>
            <Ionicons
              name="heart"
              size={20}
              color="#FFFFFF"
              style={{marginRight: 8}}
            />
            <Text style={styles.adoptButtonText}>Quero Adotar!</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  imageContainer: {
    position: 'relative',
  },
  mainImage: {
    width: width,
    height: 400,
    backgroundColor: '#F3F4F6',
  },
  favoriteButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
  },
  titleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  breed: {
    fontSize: 16,
    color: '#6B7280',
  },
  genderBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  quickInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  quickInfoText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 24,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    width: (width - 72) / 2,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  rescueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 80,
  },
  rescueInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    padding: 16,
  },
  adoptButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  adoptButtonGradient: {
    flexDirection: 'row',
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adoptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
