import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AdoptionScreen = () => {
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [filter, setFilter] = useState('all');

  // Mock data para animais disponíveis para adoção
  const [animals] = useState([
    {
      id: 1,
      name: 'Luna',
      species: 'Cachorro',
      breed: 'SRD',
      age: '2 anos',
      gender: 'Fêmea',
      size: 'Médio',
      description: 'Luna é uma cadela muito carinhosa e brincalhona. Adora crianças e se dá bem com outros animais.',
      image: 'https://via.placeholder.com/300x300/4CAF50/ffffff?text=Luna',
      vaccinated: true,
      castrated: true,
      specialNeeds: false,
      temperament: ['Carinhosa', 'Brincalhona', 'Sociável'],
      location: 'Lar Temporário - Centro'
    },
    {
      id: 2,
      name: 'Max',
      species: 'Cachorro',
      breed: 'Golden Retriever',
      age: '4 anos',
      gender: 'Macho',
      size: 'Grande',
      description: 'Max é um cão muito dócil e inteligente. Perfeito para famílias com crianças maiores.',
      image: 'https://via.placeholder.com/300x300/FF9800/ffffff?text=Max',
      vaccinated: true,
      castrated: true,
      specialNeeds: false,
      temperament: ['Dócil', 'Inteligente', 'Protetor'],
      location: 'Abrigo Principal'
    },
    {
      id: 3,
      name: 'Mimi',
      species: 'Gato',
      breed: 'SRD',
      age: '1 ano',
      gender: 'Fêmea',
      size: 'Pequeno',
      description: 'Mimi é uma gatinha muito independente e carinhosa. Ideal para apartamentos.',
      image: 'https://via.placeholder.com/300x300/E91E63/ffffff?text=Mimi',
      vaccinated: true,
      castrated: true,
      specialNeeds: false,
      temperament: ['Independente', 'Carinhosa', 'Calma'],
      location: 'Lar Temporário - Vila'
    },
    {
      id: 4,
      name: 'Thor',
      species: 'Cachorro',
      breed: 'Pastor Alemão',
      age: '3 anos',
      gender: 'Macho',
      size: 'Grande',
      description: 'Thor é um cão muito leal e ativo. Precisa de espaço para se exercitar.',
      image: 'https://via.placeholder.com/300x300/2196F3/ffffff?text=Thor',
      vaccinated: true,
      castrated: true,
      specialNeeds: false,
      temperament: ['Leal', 'Ativo', 'Inteligente'],
      location: 'Abrigo Principal'
    },
  ]);

  const filteredAnimals = filter === 'all' 
    ? animals 
    : animals.filter(animal => animal.species.toLowerCase() === filter);

  const renderAnimalCard = ({ item }) => (
    <TouchableOpacity
      style={styles.animalCard}
      onPress={() => {
        setSelectedAnimal(item);
        setModalVisible(true);
      }}
    >
      <Image source={{ uri: item.image }} style={styles.animalImage} />
      <View style={styles.animalInfo}>
        <Text style={styles.animalName}>{item.name}</Text>
        <Text style={styles.animalDetails}>
          {item.species} • {item.breed} • {item.age}
        </Text>
        <Text style={styles.animalGender}>{item.gender} • {item.size}</Text>
        <View style={styles.statusBadges}>
          {item.vaccinated && (
            <View style={[styles.badge, styles.vaccinatedBadge]}>
              <Text style={styles.badgeText}>Vacinado</Text>
            </View>
          )}
          {item.castrated && (
            <View style={[styles.badge, styles.castratedBadge]}>
              <Text style={styles.badgeText}>Castrado</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderAnimalModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView>
            <View style={styles.modalHeader}>
              <Image source={{ uri: selectedAnimal?.image }} style={styles.modalImage} />
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalInfo}>
              <Text style={styles.modalName}>{selectedAnimal?.name}</Text>
              <Text style={styles.modalSpecies}>
                {selectedAnimal?.species} • {selectedAnimal?.breed} • {selectedAnimal?.age}
              </Text>
              <Text style={styles.modalDetails}>
                {selectedAnimal?.gender} • {selectedAnimal?.size}
              </Text>

              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Sobre</Text>
                <Text style={styles.description}>{selectedAnimal?.description}</Text>
              </View>

              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Temperamento</Text>
                <View style={styles.temperamentContainer}>
                  {selectedAnimal?.temperament.map((trait, index) => (
                    <View key={index} style={styles.temperamentBadge}>
                      <Text style={styles.temperamentText}>{trait}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Informações Médicas</Text>
                <View style={styles.medicalInfo}>
                  <View style={styles.medicalItem}>
                    <Ionicons 
                      name={selectedAnimal?.vaccinated ? "checkmark-circle" : "close-circle"} 
                      size={20} 
                      color={selectedAnimal?.vaccinated ? "#4CAF50" : "#FF5722"} 
                    />
                    <Text style={styles.medicalText}>Vacinado</Text>
                  </View>
                  <View style={styles.medicalItem}>
                    <Ionicons 
                      name={selectedAnimal?.castrated ? "checkmark-circle" : "close-circle"} 
                      size={20} 
                      color={selectedAnimal?.castrated ? "#4CAF50" : "#FF5722"} 
                    />
                    <Text style={styles.medicalText}>Castrado</Text>
                  </View>
                </View>
              </View>

              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Localização</Text>
                <Text style={styles.locationText}>{selectedAnimal?.location}</Text>
              </View>

              <TouchableOpacity style={styles.adoptButton}>
                <Ionicons name="heart" size={20} color="white" />
                <Text style={styles.adoptButtonText}>Quero Adotar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Header com descrição */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Adoção</Text>
          <Text style={styles.headerSubtitle}>
            Encontre aqui cães e gatos resgatados que estão prontos para receber amor e um novo lar. 
            Adotar é transformar uma vida — inclusive a sua!
          </Text>
        </View>

        {/* Filtros */}
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'all' && styles.activeFilter]}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>
                Todos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'cachorro' && styles.activeFilter]}
              onPress={() => setFilter('cachorro')}
            >
              <Text style={[styles.filterText, filter === 'cachorro' && styles.activeFilterText]}>
                Cachorros
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'gato' && styles.activeFilter]}
              onPress={() => setFilter('gato')}
            >
              <Text style={[styles.filterText, filter === 'gato' && styles.activeFilterText]}>
                Gatos
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Lista de animais */}
        <View style={styles.animalsContainer}>
          <Text style={styles.animalsCount}>
            {filteredAnimals.length} {filteredAnimals.length === 1 ? 'animal encontrado' : 'animais encontrados'}
          </Text>
          
          <FlatList
            data={filteredAnimals}
            renderItem={renderAnimalCard}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            contentContainerStyle={styles.animalsList}
          />
        </View>

        {/* Informações sobre adoção */}
        <View style={styles.adoptionInfo}>
          <Text style={styles.infoTitle}>Processo de Adoção</Text>
          <View style={styles.infoSteps}>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>Escolha um animal e entre em contato</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>Preencha o formulário de adoção</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>Visite o animal no abrigo</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <Text style={styles.stepText}>Assine o termo de adoção</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {renderAnimalModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  activeFilter: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
  },
  activeFilterText: {
    color: 'white',
  },
  animalsContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  animalsCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  animalsList: {
    gap: 16,
  },
  animalCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  animalImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  animalInfo: {
    padding: 16,
  },
  animalName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  animalDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  animalGender: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  statusBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  vaccinatedBadge: {
    backgroundColor: '#E8F5E8',
  },
  castratedBadge: {
    backgroundColor: '#E3F2FD',
  },
  badgeText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    position: 'relative',
  },
  modalImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  modalInfo: {
    padding: 20,
  },
  modalName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  modalSpecies: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  modalDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  infoSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  temperamentContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  temperamentBadge: {
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  temperamentText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  medicalInfo: {
    gap: 8,
  },
  medicalItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  medicalText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
  },
  adoptButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
  },
  adoptButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  adoptionInfo: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  infoSteps: {
    gap: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  stepText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
});

export default AdoptionScreen;
