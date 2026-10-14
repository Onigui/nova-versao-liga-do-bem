/**
 * Carimbo digital: cadastro do CRMV, atendimento pelo QR do pet, carimbo e carteira do tutor.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert, Share, Text} from 'react-native';

const mockStore = {auth_token: 'TOKEN'};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async k => (k in mockStore ? mockStore[k] : null)),
  setItem: jest.fn(async (k, v) => {
    mockStore[k] = v;
  }),
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(async () => ({assets: [{base64: 'AAAA', type: 'image/jpeg', uri: 'file://selo.jpg'}]})),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: cb => {
    const R = require('react');
    R.useEffect(() => cb(), []); // eslint-disable-line react-hooks/exhaustive-deps
  },
}));
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
jest.mock('../src/services/AuthService', () => ({useAuth: () => ({})}));
const mockCtx = {api: jest.fn()};
jest.mock('../src/partner/PartnerContext', () => {
  const actual = jest.requireActual('../src/partner/PartnerContext');
  return {...actual, usePartner: () => mockCtx};
});

import VetProfileScreen from '../src/partner/screens/VetProfileScreen';
import PetVisitScreen, {petAge} from '../src/partner/screens/PetVisitScreen';
import StampFormScreen, {buildStampBody} from '../src/partner/screens/StampFormScreen';
import PetQrScreen from '../src/screens/PetQrScreen';
import VaccinationCardScreen, {doseStatus, latestByName} from '../src/screens/VaccinationCardScreen';
import {catalogFor, speciesKind} from '../src/utils/vaccineCatalog';

const flush = () => act(() => new Promise(r => setTimeout(r, 0)));
const allText = root =>
  root
    .findAllByType(Text)
    .map(t => [].concat(t.props.children).join(''))
    .join(' | ');
const press = async (root, id) => {
  const n = root.findAll(x => x.props.testID === id && x.props.onPress)[0];
  await act(async () => n.props.onPress());
  await flush();
};
const type = async (root, id, text) => {
  const n = root.findAll(x => x.props.testID === id && x.props.onChangeText)[0];
  await act(async () => n.props.onChangeText(text));
};

const PET = {id: 'pet_mia01', name: 'Mia', species: 'Gato', breed: 'SRD', gender: 'Fêmea', weight: 3.2, birthDate: '2024-01-10T00:00:00Z'};

describe('utilitários', () => {
  test('catálogo por espécie e idade', () => {
    expect(speciesKind('Cão')).toBe('dog');
    expect(speciesKind('gato')).toBe('cat');
    expect(catalogFor('VACCINE', 'Gato').map(v => v.name)).toContain('V4 Felina');
    expect(catalogFor('VACCINE', 'Cão').map(v => v.name)).toContain('V10');
    expect(catalogFor('DEWORMER', 'Cão')[0].nextDays).toBe(90);
    expect(petAge('2026-01-01T00:00:00Z', Date.parse('2026-10-13T00:00:00Z'))).toBe('9 meses');
    expect(petAge('2024-01-01T00:00:00Z', Date.parse('2026-10-13T00:00:00Z'))).toBe('2 anos');
  });

  test('corpo do carimbo: vacina exige lote; próxima dose calculada', () => {
    const base = {category: 'VACCINE', vaccineName: 'V4 Felina', vaccineType: '', manufacturer: 'Zoetis', batchNumber: '', notes: '', petWeight: '3,5', nextDays: 365, applicationDate: null};
    expect(buildStampBody(base).error).toMatch(/lote/);
    const now = new Date('2026-10-13T15:00:00Z');
    const {body} = buildStampBody({...base, batchNumber: 'L1'}, now);
    expect(body).toMatchObject({category: 'VACCINE', vaccineName: 'V4 Felina', manufacturer: 'Zoetis', batchNumber: 'L1', petWeight: 3.5});
    expect(body.nextDoseDate.slice(0, 10)).toBe('2027-10-13');
    expect(buildStampBody({...base, category: 'DEWORMER', vaccineName: 'Drontal', nextDays: 0}).body.nextDoseDate).toBeNull();
  });

  test('situação da próxima dose', () => {
    const now = Date.parse('2026-10-13T12:00:00Z');
    expect(doseStatus('2026-10-10T12:00:00Z', now)).toEqual({tone: 'late', label: 'Atrasada há 3 dias'});
    expect(doseStatus('2026-10-20T12:00:00Z', now).label).toBe('Faltam 7 dias');
    expect(doseStatus('2027-10-20T12:00:00Z', now).tone).toBe('ok');
    expect(latestByName([{id: 'a', vaccineName: 'V10'}, {id: 'b', vaccineName: 'v10'}, {id: 'c', vaccineName: 'Raiva'}]).map(v => v.id)).toEqual(['a', 'c']);
  });
});

describe('App Parceiros', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  test('cadastro do CRMV vai para análise', async () => {
    mockCtx.api.mockImplementation(async (method, path, body) => {
      if (method === 'GET') return {vet: null, canStamp: false};
      return {vet: {...body, crmvLabel: `CRMV-${body.crmvUf} ${body.crmv}`, status: 'PENDING'}, canStamp: false};
    });
    let tree;
    await act(async () => {
      tree = renderer.create(<VetProfileScreen navigation={{navigate: jest.fn()}} />);
    });
    await flush();
    await type(tree.root, 'vet-nome', 'Carla Lima');
    await type(tree.root, 'vet-crmv', '12.345');
    await press(tree.root, 'uf-MG');
    await press(tree.root, 'vet-salvar');
    expect(mockCtx.api).toHaveBeenLastCalledWith('POST', '/partner/vet', {fullName: 'Carla Lima', crmv: '12345', crmvUf: 'MG'});
    expect(allText(tree.root)).toContain('Em análise pela Liga');
    expect(allText(tree.root)).toContain('CRMV-MG 12345');
  });

  test('atendimento: mostra o pet, a situação do membro e a carteira; carimbar abre o formulário', async () => {
    mockCtx.api.mockResolvedValue({
      visitId: 'v1',
      pet: PET,
      owner: {firstName: 'Ana'},
      member: {active: true, memberId: 'MEM00000001'},
      records: [{id: 'r1', vaccineName: 'V4 Felina', category: 'VACCINE', applicationDate: '2026-10-13T12:00:00Z', isVerified: true, clinicName: 'Clínica Amigo', canCorrect: true}],
    });
    const nav = {navigate: jest.fn(), replace: jest.fn()};
    let tree;
    await act(async () => {
      tree = renderer.create(<PetVisitScreen navigation={nav} route={{params: {code: 'LDBP.pet_mia01.1.x'}}} />);
    });
    await flush();
    expect(mockCtx.api).toHaveBeenCalledWith('POST', '/partner/pets/lookup', {code: 'LDBP.pet_mia01.1.x'});
    const t = allText(tree.root);
    expect(t).toContain('Mia');
    expect(t).toContain('Tutor(a): Ana');
    expect(t).toContain('Membro ativo (MEM00000001)');
    expect(t).toContain('Corrigir (até 24 h)');
    await press(tree.root, 'carimbar');
    expect(nav.navigate).toHaveBeenCalledWith('StampForm', {visitId: 'v1', pet: PET});
  });

  test('QR errado mostra a explicação e oferece ler de novo', async () => {
    mockCtx.api.mockRejectedValue(Object.assign(new Error('Este é o QR da carteirinha do membro.'), {code: 'CARD_QR'}));
    let tree;
    await act(async () => {
      tree = renderer.create(<PetVisitScreen navigation={{navigate: jest.fn(), replace: jest.fn()}} route={{params: {code: 'LDB2.x'}}} />);
    });
    await flush();
    expect(allText(tree.root)).toContain('QR da carteirinha');
  });

  test('carimbo: escolhe a vacina do catálogo, lote, foto do selo e envia', async () => {
    mockCtx.api.mockResolvedValue({record: {id: 'r9', vaccineName: 'V4 Felina'}});
    const nav = {navigate: jest.fn()};
    let tree;
    await act(async () => {
      tree = renderer.create(<StampFormScreen navigation={nav} route={{params: {visitId: 'v1', pet: PET}}} />);
    });
    await press(tree.root, 'item-V4 Felina');
    await press(tree.root, 'confirmar-carimbo');
    expect(allText(tree.root)).toMatch(/lote/i);
    await type(tree.root, 'lote', 'l123');
    await press(tree.root, 'foto-selo');
    await press(tree.root, 'confirmar-carimbo');
    const [method, path, body] = mockCtx.api.mock.calls[mockCtx.api.mock.calls.length - 1];
    expect(method).toBe('POST');
    expect(path).toBe('/partner/pets/visits/v1/records');
    expect(body).toMatchObject({category: 'VACCINE', vaccineName: 'V4 Felina', batchNumber: 'L123', petWeight: 3.2, labelPhoto: 'data:image/jpeg;base64,AAAA'});
    expect(body.nextDoseDate).toBeTruthy();
    expect(nav.navigate).toHaveBeenCalledWith({name: 'PetVisit', params: {saved: {id: 'r9', vaccineName: 'V4 Felina'}}, merge: true});
  });

  test('carimbo repetido no dia pede confirmação e reenvia', async () => {
    mockCtx.api.mockRejectedValueOnce(Object.assign(new Error('V10 já foi carimbada para este pet hoje.'), {code: 'DUPLICATE'})).mockResolvedValueOnce({record: {id: 'r2'}});
    let tree;
    await act(async () => {
      tree = renderer.create(<StampFormScreen navigation={{navigate: jest.fn()}} route={{params: {visitId: 'v1', pet: {...PET, species: 'Cão'}}}} />);
    });
    await press(tree.root, 'item-V10');
    await type(tree.root, 'lote', 'A1');
    await press(tree.root, 'confirmar-carimbo');
    const [, , buttons] = Alert.alert.mock.calls[0];
    await act(async () => buttons[1].onPress());
    await flush();
    expect(mockCtx.api.mock.calls[1][2]).toMatchObject({confirmDuplicate: true});
  });
});

describe('App dos membros', () => {
  test('QR do pet: busca o código assinado e mostra', async () => {
    const fetchImpl = jest.fn(async () => ({ok: true, json: async () => ({code: 'LDBP.pet_mia01.1.sig', expiresAt: new Date(Date.now() + 600e3).toISOString()})}));
    let tree;
    await act(async () => {
      tree = renderer.create(<PetQrScreen navigation={{goBack: jest.fn()}} route={{params: {petId: 'pet_mia01', petName: 'Mia'}}} fetchImpl={fetchImpl} />);
    });
    await flush();
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.test/api/user/pets/pet_mia01/stamp-token');
    expect(tree.root.findAllByType('QRCode')[0].props.value).toBe('LDBP.pet_mia01.1.sig');
    expect(allText(tree.root)).toContain('Carteira de Mia');
    await act(async () => tree.unmount());
  });

  test('carteira: carimbo em destaque, resumo, compartilhar e mostrar ao veterinário', async () => {
    const pet = {
      ...PET,
      share: null,
      vaccinations: [
        {id: 'r1', vaccineName: 'V4 Felina', category: 'VACCINE', applicationDate: '2026-10-13T12:00:00Z', nextDoseDate: '2027-10-13T12:00:00Z', isVerified: true, veterinarian: 'Carla Lima', veterinarianCRMV: 'CRMV-SP 12345', clinicName: 'Clínica Amigo', hasLabelPhoto: true, manufacturer: 'Zoetis', batchNumber: 'L123'},
        {id: 'r2', vaccineName: 'Gripe', category: 'VACCINE', applicationDate: '2026-01-10T12:00:00Z', isVerified: false},
      ],
    };
    global.fetch = jest.fn(async (url, init) => {
      if (String(url).endsWith('/share')) return {ok: true, json: async () => ({url: 'https://api.test/api/public/pet-card/abc'})};
      return {ok: true, json: async () => ({pet})};
    });
    jest.spyOn(Share, 'share').mockResolvedValue({});
    const nav = {navigate: jest.fn(), goBack: jest.fn()};
    let tree;
    await act(async () => {
      tree = renderer.create(<VaccinationCardScreen navigation={nav} route={{params: {petId: 'pet_mia01'}}} />);
    });
    await flush();
    const t = allText(tree.root);
    expect(t).toContain('1 carimbada(s) por veterinário');
    expect(t).toContain('CARIMBADA pelo veterinário parceiro');
    expect(t).toContain('Informada por você');
    expect(t).toContain('Ver foto do selo');
    expect(tree.root.findAll(n => n.props.testID === 'registro-carimbado').length).toBeGreaterThan(0);
    await press(tree.root, 'mostrar-veterinario');
    expect(nav.navigate).toHaveBeenCalledWith('PetQr', {petId: 'pet_mia01', petName: 'Mia'});
    await press(tree.root, 'compartilhar-carteira');
    expect(Share.share).toHaveBeenCalledWith({message: expect.stringContaining('https://api.test/api/public/pet-card/abc')});
    expect(allText(tree.root)).toContain('Desativar link');
  });
});
