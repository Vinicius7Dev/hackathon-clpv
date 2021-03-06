import React, { useCallback, useState, useEffect } from 'react';
import { Alert, KeyboardAvoidingView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Feather';

import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  Region,
} from 'react-native-maps';
import * as Yup from 'yup';

import { fetchLocalMapBox } from '../../scripts/apiMapBox';
import {
  Container,
  Content,
  TitleArea,
  ProblemTypeArea,
  ProblemTypeLabel,
  Section,
  PhotosArea,
  EmptyListMessageArea,
  EmptyListMessage,
  AddPhotoButtonView,
  DescriptionInput,
  InputGroupMargin,
  InputMargin,
  DateView,
  MapArea,
} from './styles';

import theme from '../../global/styles/theme';
import Header from '../../components/Header';
import Title from '../../components/Title';
import Description from '../../components/Description';
import Button from '../../components/Button';
import Input from '../../components/Input';
import SelectOptions, { IOptionData } from '../../components/SelectOptions';
import DateTimeInput from '../../components/DateTimeInput';
import PhotoItem from '../../components/PhotoItem';

import { formatDate, formatTime, IDatePickerEvent } from '../../utils/formatDateTime';
import ModalView from '../../components/ModalView';

interface IRouteParams {
  problem_type_id: number;
}

const {
  text_dark,
} = theme.colors;

const RegisterOccurrence: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { problem_type_id } = route.params as IRouteParams;

  const [addressSuggestionsIsOpen, setAddressSuggestionsIsOpen] = useState(false);
  const [locationOptions, setLocationOptions] = useState<IOptionData[]>([]);
  const [startMapPosition, setStartMapPosition] = useState<Region>({
    latitude: -20.5393727,
    longitude: -47.4018742,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  });

  const [modalIsVisible, setModalIsVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  const [problemTypeId, setProblemTypeId] = useState(problem_type_id);
  const [images, setImages] = useState<Asset[]>([]);
  const [observations, setObservations] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phoneForPurchase, setPhoneForPurchase] = useState('');
  const [date, setDate] = useState(formatDate(new Date()));
  const [time, setTime] = useState(formatTime(new Date()));
  const [selectedAddress, setSelectedAddress] = useState<IOptionData>();
  const [number, setNumber] = useState<number>();
  const [referencePoint, setReferencePoint] = useState('');

  const goToHomeScreen = useCallback(() => {
    navigation.reset({
      routes: [{ name: 'Home', params: { showTnkdModal: true } }],
      index: 0,
    });
  }, [navigation]);

  const handleCloseModal = useCallback(() => {
    setModalIsVisible(false);
  }, []);

  const handleDeleteSelectedImage = useCallback((index: number) => {
    const newImagesArray = images;

    newImagesArray.splice(index, 1);

    setImages([...newImagesArray]);
  }, [images, setImages]);

  const handleQuestionToDeleteImage = useCallback((index: number) => {
    Alert.alert(
      'Deseja apagar a imagem?',
      'Esta a????o n??o pode ser desfeita!',
      [
        {
          text: 'Sim',
          onPress: () => handleDeleteSelectedImage(index),
        },
        { text: 'N??o' },
      ],
    );
  }, [handleDeleteSelectedImage]);

  const handleGetImage = useCallback(() => {
    launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 99,
    }, (response) => {
      if (response.didCancel) return;

      if (response.errorCode || response.errorMessage) {
        Alert.alert('Erro ao carregar as fotos!');
        return;
      }

      if (response.assets) {
        setImages([...images, ...response.assets]);
      }
    });
  }, [images]);

  const handleSubmitForm = useCallback(async () => {
    try {
      if (images.length === 0) {
        Alert.alert('Adicione as imagens do ocorrido!');
        return;
      }

      const shape = Yup.object().shape({
        problemTypeId: Yup.number().required('O tipo de problema n??o foi encontrado!'),
        observations: Yup.string().required('Informe a suas observa????es!'),
        ownerName: Yup.string().when('problemTypeId', {
          is: 2,
          then: Yup.string().required('Informe o nome do propriet??rio!'),
          otherwise: Yup.string(),
        }),
        phoneForPurchase: Yup.string().when('problemTypeId', {
          is: 2,
          then: Yup.string().required('Informe o telefone para compra de lotes!'),
          otherwise: Yup.string(),
        }),
        date: Yup.string().required('Informe a data do ocorrido!'),
        time: Yup.string().required('Informe o hor??rio do ocorrido!'),
        selectedAddress: Yup.string().required('Informe o endere??o do ocorrido!'),
        number: Yup.number().required('Informe o n??mero do local!'),
      });

      await shape.validate({
        problemTypeId,
        observations,
        ownerName,
        phoneForPurchase,
        date,
        time,
        selectedAddress: JSON.stringify(selectedAddress),
        number,
      });

      // ENVIAR O PONTO DE REFER??NCIA
      // ENVIAR AS IMAGENS TAMB??M

      goToHomeScreen();
    } catch (error) {
      Alert.alert(error.errors[0]);
    }
  }, [
    problemTypeId,
    images,
    observations,
    ownerName,
    phoneForPurchase,
    date,
    time,
    selectedAddress,
    number,
    goToHomeScreen,
  ]);

  const handleOnSelectAddress = useCallback((address: IOptionData) => {
    setSelectedAddress(address);

    setAddressSuggestionsIsOpen(false);

    setStartMapPosition({
      latitude: address.coords.lat,
      longitude: address.coords.long,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  }, []);

  const handleSearchStreet = useCallback(async (text: string) => {
    if (text.length <= 5) return;

    const result = await fetchLocalMapBox(text);

    if (result.type === 'error') {
      return;
    }

    const resultAddressType = result.features.filter(
      (address: { place_type: string; }) => address.place_type[0] === 'address',
    );

    const cityAddress = resultAddressType.filter(
      (address: { place_name: string }) => address.place_name.indexOf('Franca - S??o Paulo,') !== -1,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const addressSuggestions = cityAddress.map((address: any) => ({
      id: address.id,
      label: address.text,
      value: address.place_name,
      coords: {
        lat: address.geometry.coordinates[1],
        long: address.geometry.coordinates[0],
      },
    }));

    setLocationOptions(addressSuggestions);
  }, []);

  const handleSetDate = useCallback((e) => {
    const { type, nativeEvent } = e as IDatePickerEvent;

    if (type !== 'set') return;

    const formatedDate = formatDate(nativeEvent.timestamp);

    setDate(formatedDate);
  }, []);

  const handleSetTime = useCallback((e) => {
    const { type, nativeEvent } = e as IDatePickerEvent;

    if (type !== 'set') return;

    const formatedTime = formatTime(nativeEvent.timestamp);

    setTime(formatedTime);
  }, []);

  useEffect(() => {
    if (problemTypeId === 0) {
      setModalTitle('Identifique o poss??vel infrator!');
      setModalMessage('Lembre-se de identificar o poss??vel infrator por meio das observa????es e adicionando novas fotos, apresentando detalhes do autom??vel (como a placa, a marca, entre outros), empresa envolvida, vizinho do respons??vel pelo ato, ou qualquer outra forma de identifica????o do indiv??duo.\n\nQuanto mais detalhes tivermos do ocorrido, maior ?? a certeza da resolu????o correta do caso!');
      setModalIsVisible(true);
    }
  }, [problemTypeId]);

  return (
    <Container>
      <KeyboardAvoidingView>
        <Header />

        <Content>
          <ProblemTypeArea>
            <ProblemTypeLabel>
              Tipo de problema:
            </ProblemTypeLabel>

            <Title
              color="alert_light"
              fontSize={35}
            >
              Loteamento Irregular
            </Title>
          </ProblemTypeArea>

          <TitleArea>
            <Title textAlign="center">
              Registrar
              {'\n'}
              Ocorr??ncia
            </Title>

            <Description
              color="alert_dark"
              textAlign="center"
              fontSize={15}
            >
              N??o se preocupe! Somente pessoas autorizadas v??o ter acesso ??s suas ocorr??ncias ????
            </Description>
          </TitleArea>

          <Section>
            <Title
              fontSize={30}
              textAlign="center"
            >
              Nos envie Fotos
              {'\n'}
              do Ocorrido
            </Title>

            <PhotosArea>
              {
                images.length === 0
                  ? (
                    <EmptyListMessageArea>
                      <Icon
                        name="alert-triangle"
                        size={24}
                        color={text_dark}
                      />

                      <EmptyListMessage>
                        Nenhuma foto
                        {'\n'}
                        adicionada
                      </EmptyListMessage>
                    </EmptyListMessageArea>
                  )
                  : images.map((image, index) => (
                    <PhotoItem
                      key={index.toString()}
                      index={index}
                      uri={image.uri as string}
                      onDelete={() => handleQuestionToDeleteImage(index)}
                    />
                  ))
              }
            </PhotosArea>

            <AddPhotoButtonView>
              <Button
                text="Adicionar"
                icon="camera"
                onPress={handleGetImage}
              />
            </AddPhotoButtonView>
          </Section>

          <Section>
            <Title
              fontSize={30}
              textAlign="center"
            >
              Observa????es
            </Title>

            <Description
              fontSize={15}
              color="primary2"
            >
              Nos conte melhor sobre o acontecimento,
              quanto mais informa????es voc?? passar, mais
              r??pido vamos conseguir solucionar seu caso ????
            </Description>

            <DescriptionInput
              style={{ textAlignVertical: 'top' }}
              placeholder="Descreva aqui o acontecimento..."
              onChangeText={setObservations}
              multiline
            />
          </Section>

          {
            problemTypeId === 2 && (
              <Section>
                <Title
                  fontSize={30}
                  textAlign="center"
                >
                  Sobre o Propriet??rio
                </Title>

                <InputGroupMargin>
                  <Description
                    fontSize={15}
                    color="primary2"
                  >
                    Nos conte mais sobre o propriet??rio...
                  </Description>

                  <InputMargin>
                    <Input
                      iconName="user"
                      placeholder="Nome do propriet??rio"
                      onChangeText={setOwnerName}
                    />
                  </InputMargin>
                  <InputMargin>
                    <Input
                      iconName="phone"
                      placeholder="Telefone para compra de lotes"
                      onChangeText={setPhoneForPurchase}
                    />
                  </InputMargin>
                </InputGroupMargin>
              </Section>
            )
          }

          <Section>
            <Title
              fontSize={30}
              textAlign="center"
            >
              Data do Ocorrido
            </Title>

            <InputGroupMargin>
              <DateView>
                <DateTimeInput
                  value={new Date()}
                  iconName="calendar"
                  valueText={date}
                  onChangeValue={handleSetDate}
                />

                <DateTimeInput
                  value={new Date()}
                  iconName="clock"
                  valueText={time}
                  mode="time"
                  onChangeValue={handleSetTime}
                />
              </DateView>
            </InputGroupMargin>
          </Section>

          <Section>
            <Title
              fontSize={30}
              textAlign="center"
            >
              Localiza????o
            </Title>

            <InputGroupMargin>
              <InputMargin>
                <Input
                  iconName="map-pin"
                  placeholder="Informe a localiza????o do ocorrido"
                  onChangeText={handleSearchStreet}
                  onFocus={() => setAddressSuggestionsIsOpen(true)}
                />

                { addressSuggestionsIsOpen && (
                  <SelectOptions
                    options={locationOptions}
                    onSelectOption={handleOnSelectAddress}
                    onClose={() => setAddressSuggestionsIsOpen(false)}
                  />
                )}
              </InputMargin>

              <InputMargin>
                <Input
                  iconName="home"
                  placeholder="Informe o n??mero do local"
                  onChangeText={(text) => setNumber(Number(text))}
                  keyboardType="numeric"
                />
              </InputMargin>

              <InputMargin>
                <Input
                  iconName="info"
                  placeholder="Informe um ponto de refer??ncia"
                  onChangeText={setReferencePoint}
                />
              </InputMargin>

              <Description
                fontSize={15}
                color="primary2"
              >
                Veja no mapa o local selecionado
              </Description>

              <MapArea>
                <MapView
                  style={{
                    width: '95%',
                    height: '95%',
                    borderRadius: 8,
                  }}
                  provider={PROVIDER_GOOGLE}
                  region={{
                    latitude: startMapPosition.latitude,
                    longitude: startMapPosition.longitude,
                    latitudeDelta: startMapPosition.latitudeDelta,
                    longitudeDelta: startMapPosition.longitudeDelta,
                  }}
                  initialRegion={startMapPosition}
                >
                  {
                    selectedAddress
                    && (
                    <Marker
                      coordinate={{
                        latitude: selectedAddress.coords.lat,
                        longitude: selectedAddress.coords.long,
                      }}
                    />
                    )
                  }
                </MapView>
              </MapArea>
            </InputGroupMargin>
          </Section>

          <Button text="Registrar Ocorr??ncia" onPress={handleSubmitForm} />
        </Content>
      </KeyboardAvoidingView>

      {
        modalIsVisible && (
        <ModalView
          visible={modalIsVisible}
          title={modalTitle}
          message={modalMessage}
          onCloseModal={handleCloseModal}
        />
        )
      }
    </Container>
  );
};

export default RegisterOccurrence;
