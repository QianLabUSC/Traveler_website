import * as React from 'react';
import { useEffect } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { HashRouter as Router, Route, Switch, Redirect, useHistory, useLocation } from "react-router-dom";
import { createMuiTheme } from '@material-ui/core/styles';
import { StateProvider, useStateValue, Action } from './state';
import Intro from './pages/intro';
import Decision from './pages/decision';
import Strategy from './pages/strategy';
import Conclusion from './pages/conclusion';
import Hypo from './pages/hypo';
import Survey from './pages/survey';
import { Geo } from './pages/geo';
import { Annotation } from './pages/annotation';
import { SavedProgress } from './pages/savedProgress';
import { GlobalDialog } from './components/GlobalDialog';
import { logTrace } from './logger';
import { TraceType, ActualStrategyTransect } from './types';
import ThemeProvider from '@material-ui/core/styles/MuiThemeProvider';
import { storeState, stateExists, removeStoredState, getStoredState } from './handlers/LocalStorageHandler';
import { AUTO_LOAD_MS, SampleState, defaultHypothesisResponse } from './constants';
import { getMoistureData, getShearData } from './util';
import { initialStrategyAlt } from './strategyTemplates';

const theme = createMuiTheme({
  palette: {
    primary: { main: '#114B5F' },
    secondary: { main: '#028090' },
  },
});

const useStyles = makeStyles(theme => {
  return {
    body: {
      margin: 0
    }
  };
});

let currentPathname = '', currentSearch = '';

// A wrapper in order to access the state value
function RouteWrapper() {
  const [globalState, dispatch] = useStateValue();
  const { dataVersion } = globalState;
  const history = useHistory();
  const location = useLocation();

  const addActualStrategyTransect = (type: 'planned' | 'deviated', id: number) => {
    const actualStrategyTransect: ActualStrategyTransect = {
      type: type,
      number: id,
      samples: [],
      localHypotheses: {...defaultHypothesisResponse},
      globalHypotheses: {...defaultHypothesisResponse}
    };
    dispatch({ type: Action.ADD_ACTUAL_STRATEGY_TRANSECT, value: actualStrategyTransect });
  }

  useEffect(() => {
    history.listen((newLocation, action) => {
      logTrace(TraceType.ENTER_PAGE, newLocation.pathname);
      // This will activate anytime any extension is pushed to the URL (e.g., "geo", "strategy", "decision", etc.)
      if (action === "PUSH") {
        if (
          newLocation.pathname !== currentPathname ||
          newLocation.search !== currentSearch
        ) {
          // Save new location
          currentPathname = newLocation.pathname;
          currentSearch = newLocation.search;
  
          // Clone location object and push it to history
          history.push({
            pathname: newLocation.pathname,
            search: newLocation.search
          });
        }
      } else {
        // Send user back to current page if they try to navigate back to previous page.
        history.go(1);
      }
    });
  }, [history]);

// Load initial strategy and shear, moisture, and grain datasets
  useEffect(() => {
    const shearData = getShearData();
    const moistureData = getMoistureData();  
    dispatch({ type: Action.SET_MOISTURE_DATA, value: moistureData });
    dispatch({ type: Action.SET_FULL_DATA, value: shearData });
    dispatch({ type: Action.SET_STRATEGY_TRANSECTS, value: initialStrategyAlt.transectIndices })
    dispatch({ type: Action.SET_STRATEGY_SAMPLES, value: initialStrategyAlt.transectSamples })
    dispatch({ type: Action.SET_CUR_ROW_IDX, value: 0 });
    dispatch({ type: Action.CHANGE_SAMPLE_STATE, value: SampleState.FEEDBACK });
    addActualStrategyTransect('planned', initialStrategyAlt.transectIndices[0].number);
  }, []);

  // When user closes the tab, save the user's progress
  useEffect(() => {

    // This is called before tab closes
    window.addEventListener('beforeunload', (e) => {
      e.preventDefault();
      // Execute this if the user is past the intro section and if the full survey hasn't been submitted yet
      if (location.pathname !== "/" && !globalState.submitted) {
        let { chart } = globalState;
        // Clear the chart data because it contains circular references on the "data" and "datasets" properties.
        // If this data isn't cleared, it causes issues when trying to stringify the globalState in the "storeState"
        // function below. The chart is cleared in the "dispatch" function in this 'beforeunload' step prior to
        // storing the globalState in the 'unload' step because the globalState wasn't updating immediately when 
        // combining the "dispatch" and "storeState" functions together in one step.
        if (chart) {
          dispatch({ type: Action.SET_CHART, value: null });
        }
      }
    });

    // This is called when the tab closes
    window.addEventListener('unload', () => {
      // Execute this if the user is past the intro section and if the full survey hasn't been submitted yet
      if (location.pathname !== "/" && !globalState.submitted) {
        // Store the global state so it can be retrieved again when the user returns to the site 
        storeState(location.pathname, globalState);

      // If the user is still on the intro section or if the survey has already been submitted, remove the
      // stored state so that the user starts on a fresh survey form when returning to the site
      } else if (globalState.submitted) {
        removeStoredState();
      }
    });
  });

  // If there is a previously saved state, display a temporary screen asking whether the user wants to continue
  // the previous session.
  if (stateExists()) {
    const data = getStoredState();
    if (!data) {
      removeStoredState();
      history.push("/");
    } else {
      const {path, state, date} = data;
      // If the last save was recent, automatically load that state.
      if ((Date.now() - date) < AUTO_LOAD_MS) {
        removeStoredState();
        dispatch({type: Action.SET_STATE, value: state});
        history.push(path);
      }
    }

    return <SavedProgress
      onNew={() => {
        const data = getStoredState();
        const { robotVersion } = data.state;
        removeStoredState();
        history.push("/");
        dispatch({type: Action.SET_ROBOT_VERSION, value: robotVersion});
      }}
      onContinue={() => {
        const {path, state} = data;
        removeStoredState();
        dispatch({type: Action.SET_STATE, value: state});
        history.push(path);
      }}/>
  }

  // Page router - Redirect the user to the intro section if the user has not yet completed it yet
  return (
    <div>
      <Switch>
        <Route exact path="/" component={Intro}/>
        {/* <Route path="/strategy" render={props => (
          globalState.introCompleted ? <Strategy/> : <Redirect to={{ pathname: '/'}}/> )} /> */}
        <Route path="/decision" render={props => (
          globalState.introCompleted ? <Decision/> : <Redirect to={{ pathname: '/'}}/> )} />
        <Route path="/conclusion" render={props => (
          globalState.introCompleted ? <Conclusion/> : <Redirect to={{ pathname: '/'}}/> )} />
        {/* <Route path="/hypo" render={props => (
          globalState.introCompleted ? <Hypo/> : <Redirect to={{ pathname: '/'}}/> )} /> */}
        {/* <Route path="/geo" render={props => (
          globalState.introCompleted ? <Geo/> : <Redirect to={{ pathname: '/'}}/> )} /> */}
        <Route path="/annotation" render={props => (
          globalState.introCompleted ? <Annotation/> : <Redirect to={{ pathname: '/'}}/> )} />
        <Route path="/survey" render={props => (
          globalState.introCompleted ? <Survey/> : <Redirect to={{ pathname: '/'}}/> )} />
      </Switch>
      <GlobalDialog />
    </div>
  );
}

export function App(){
  const classes = useStyles();
  document.title = "Geologic Field Decision Making";
 
  return (
    <ThemeProvider theme={theme}>
      <div className={classes.body}>
        <StateProvider>
          <Router>
            <RouteWrapper />
          </Router>
        </StateProvider>
      </div>
    </ThemeProvider>
  );
}