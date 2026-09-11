import { setLanguage, language } from "./i18n";
setLanguage(language());
import { createRoot } from "react-dom/client";
import { BrandGate } from "./BrandGate";
import { CaptureStudio } from './CaptureStudio';
import './domainMigration.css';
import "./styles.css";
import "./workspace.css";
import { startPwaUpdates } from "./pwaUpdates";

const studio=new URLSearchParams(location.search).get('studio')==='1';
if(!studio)startPwaUpdates();
createRoot(document.getElementById("root")!).render(studio?<CaptureStudio/>:<BrandGate />);

import "./release.css";

import "./compactDesk.css";

import "./coinAndEffects.css";

import "./sweepLayout.css";

import "./cardClarity.css";

import "./soundAndMotion.css";

import "./captureMode.css";

import "./timeTrial.css";

import "./release30.css";

import "./community.css";
