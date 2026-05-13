/**
 * @format
 * react-native-gesture-handler deve ser o primeiro import do entry (Android + Navigation).
 */
import 'react-native-gesture-handler';
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
