import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const VolunteersScreen = () => {
  const [selectedVolunteer, setSelectedVolunteer] = useState(null);

  // Mock data para voluntários
  const [volunteers] = useState([
    {
      id: 1,
      name: 'Maria Silva',
      role: 'Coordenadora Geral',
      experience: '5 anos',
      image: 'https://via.placeholder.com/100x100/4CAF50/ffffff?text=MS',
      specialties: ['Coordenação', 'Adoção', 'Eventos'],
      description: 'Maria coordena todas as atividades da Liga do Bem há 5 anos. Sua paixão por animais começou na infância.',
      phone: '(14) 99888-1234',
      email: 'maria@ligadobembotucatu.org.br',
      availability: 'Segunda a Sexta - 8h às 18h'
    },
    {
      id: 2,
      name: 'João Santos',
      role: 'Veterinário Voluntário',
      experience: '3 anos',
      image: 'https://via.placeholder.com/100x100/FF9800/ffffff?text=JS',
      specialties: ['Veterinária', 'Emergências', 'Cirurgias'],
      description: 'Dr. João oferece atendimento veterinário gratuito para nossos resgatados. Especialista em cirurgias.',
      phone: '(14) 99777-5678',
      email: 'joao@ligadobembotucatu.org.br',
      availability: 'Sábados e Domingos - 9h às 16h'
    },
    {
      id: 3,
      name: 'Ana Costa',
      role: 'Cuidadora',
      experience: '2 anos',
      image: 'https://via.placeholder.com/100x100/E91E63/ffffff?text=AC',
      specialties: ['Cuidados Diários', 'Socialização', 'Treinamento'],
      description: 'Ana cuida dos animais diariamente no abrigo. Especialista em socialização de animais traumatizados.',
      phone: '(14) 99666-9012',
      email: 'ana@ligadobembotucatu.org.br',
      availability: 'Todos os dias - 6h às 20h'
    },
    {
      id: 4,
      name: 'Carlos Mendes',
      role: 'Motorista Voluntário',
      experience: '1 ano',
      image: 'https://via.placeholder.com/100x100/2196F3/ffffff?text=CM',
      specialties: ['Transporte', 'Resgates', 'Logística'],
      description: 'Carlos ajuda no transporte de animais para consultas, resgates e eventos da Liga do Bem.',
      phone: '(14) 99555-3456',
      email: 'carlos@ligadobembotucatu.org.br',
      availability: 'Sob demanda - 24h'
    },
  ]);

  const handleContact = (volunteer, type) => {
    const message = type === 'phone' 
      ? `Ligando para ${volunteer.name}...`
      : `Enviando email para ${volunteer.name}...`;
    
    Alert.alert('Contato', message);
  };

  const handleJoinVolunteers = () => {
    Alert.alert(
      'Torne-se um Voluntário',
      'Para se tornar um voluntário da Liga do Bem, entre em contato conosco através do telefone (14) 99822-5023 ou email administrativo@ligadobembotucatu.org.br',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Entrar em Contato', onPress: () => Alert.alert('Contato', 'Redirecionando para contato...') }
      ]
    );
  };

  const renderVolunteerCard = ({ item }) => (
    <TouchableOpacity
      style={styles.volunteerCard}
      onPress={() => setSelectedVolunteer(item)}
    >
      <Image source={{ uri: item.image }} style={styles.volunteerImage} />
      <View style={styles.volunteerInfo}>
        <Text style={styles.volunteerName}>{item.name}</Text>
        <Text style={styles.volunteerRole}>{item.role}</Text>
        <Text style={styles.volunteerExperience}>Experiência: {item.experience}</Text>
        <View style={styles.specialtiesContainer}>
          {item.specialties.slice(0, 2).map((specialty, index) => (
            <View key={index} style={styles.specialtyBadge}>
              <Text style={styles.specialtyText}>{specialty}</Text>
            </View>
          ))}
          {item.specialties.length > 2 && (
            <Text style={styles.moreSpecialties}>+{item.specialties.length - 2}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Voluntários</Text>
          <Text style={styles.headerSubtitle}>
            Conheça quem está por trás dos cuidados diários com nossos animais. 
            Aqui você encontra nossos voluntários oficiais e pode saber como se juntar a essa causa!
          </Text>
        </View>

        {/* Estatísticas */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>25+</Text>
            <Text style={styles.statLabel}>Voluntários Ativos</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>500+</Text>
            <Text style={styles.statLabel}>Animais Resgatados</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>3</Text>
            <Text style={styles.statLabel}>Anos de Atuação</Text>
          </View>
        </View>

        {/* Botão para se tornar voluntário */}
        <View style={styles.joinContainer}>
          <TouchableOpacity style={styles.joinButton} onPress={handleJoinVolunteers}>
            <Ionicons name="person-add" size={24} color="white" />
            <Text style={styles.joinButtonText}>Torne-se um Voluntário</Text>
          </TouchableOpacity>
        </View>

        {/* Lista de voluntários */}
        <View style={styles.volunteersSection}>
          <Text style={styles.sectionTitle}>Nossa Equipe</Text>
          
          <View style={styles.volunteersList}>
            {volunteers.map((volunteer) => (
              <View key={volunteer.id} style={styles.volunteerCard}>
                <Image source={{ uri: volunteer.image }} style={styles.volunteerImage} />
                <View style={styles.volunteerInfo}>
                  <Text style={styles.volunteerName}>{volunteer.name}</Text>
                  <Text style={styles.volunteerRole}>{volunteer.role}</Text>
                  <Text style={styles.volunteerExperience}>Experiência: {volunteer.experience}</Text>
                  <Text style={styles.volunteerDescription} numberOfLines={2}>
                    {volunteer.description}
                  </Text>
                  <View style={styles.specialtiesContainer}>
                    {volunteer.specialties.slice(0, 3).map((specialty, index) => (
                      <View key={index} style={styles.specialtyBadge}>
                        <Text style={styles.specialtyText}>{specialty}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.contactButtons}>
                    <TouchableOpacity
                      style={styles.contactButton}
                      onPress={() => handleContact(volunteer, 'phone')}
                    >
                      <Ionicons name="call" size={16} color="#4CAF50" />
                      <Text style={styles.contactButtonText}>Ligar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.contactButton}
                      onPress={() => handleContact(volunteer, 'email')}
                    >
                      <Ionicons name="mail" size={16} color="#4CAF50" />
                      <Text style={styles.contactButtonText}>Email</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Como ser voluntário */}
        <View style={styles.howToVolunteer}>
          <Text style={styles.howToTitle}>Como Ser Voluntário</Text>
          <View style={styles.stepsContainer}>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>Entre em contato conosco</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>Preencha o formulário de voluntário</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>Participe da entrevista</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <Text style={styles.stepText}>Receba treinamento inicial</Text>
            </View>
          </View>
        </View>

        {/* Áreas de atuação */}
        <View style={styles.areasContainer}>
          <Text style={styles.areasTitle}>Áreas de Atuação</Text>
          <View style={styles.areasGrid}>
            <View style={styles.areaCard}>
              <Ionicons name="medical" size={32} color="#4CAF50" />
              <Text style={styles.areaTitle}>Veterinária</Text>
              <Text style={styles.areaDescription}>
                Atendimento médico e cirúrgico
              </Text>
            </View>
            <View style={styles.areaCard}>
              <Ionicons name="home" size={32} color="#4CAF50" />
              <Text style={styles.areaTitle}>Cuidados</Text>
              <Text style={styles.areaDescription}>
                Cuidados diários e socialização
              </Text>
            </View>
            <View style={styles.areaCard}>
              <Ionicons name="car" size={32} color="#4CAF50" />
              <Text style={styles.areaTitle}>Transporte</Text>
              <Text style={styles.areaDescription}>
                Transporte e resgates
              </Text>
            </View>
            <View style={styles.areaCard}>
              <Ionicons name="calendar" size={32} color="#4CAF50" />
              <Text style={styles.areaTitle}>Eventos</Text>
              <Text style={styles.areaDescription}>
                Organização de eventos
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  joinContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  joinButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  joinButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  volunteersSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  volunteersList: {
    gap: 16,
  },
  volunteerCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  volunteerImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  volunteerInfo: {
    flex: 1,
  },
  volunteerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  volunteerRole: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginBottom: 4,
  },
  volunteerExperience: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  volunteerDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
    marginBottom: 12,
  },
  specialtiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  specialtyBadge: {
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  specialtyText: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: '500',
  },
  moreSpecialties: {
    fontSize: 10,
    color: '#666',
    alignSelf: 'center',
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
    gap: 4,
  },
  contactButtonText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  howToVolunteer: {
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
  howToTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  stepsContainer: {
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
  areasContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  areasTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  areasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  areaCard: {
    backgroundColor: 'white',
    width: '47%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  areaTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  areaDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

export default VolunteersScreen;
