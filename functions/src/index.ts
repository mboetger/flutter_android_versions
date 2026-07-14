import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import axios from 'axios';

admin.initializeApp();

const REPO_URL = 'https://raw.githubusercontent.com/flutter/flutter/master/packages/flutter_tools/gradle/src/main/kotlin/DependencyVersionChecker.kt';

function extractVersion(content: string, varName: string): string | null {
  const regex = new RegExp(`val\\s+${varName}:\\s*Version\\s*=\\s*Version\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)`);
  const match = content.match(regex);
  if (match) {
    return `${match[1]}.${match[2]}.${match[3]}`;
  }
  return null;
}

function extractAgpVersion(content: string, varName: string): string | null {
  const regex = new RegExp(`val\\s+${varName}:\\s*AndroidPluginVersion\\s*=\\s*AndroidPluginVersion\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)`);
  const match = content.match(regex);
  if (match) {
    return `${match[1]}.${match[2]}.${match[3]}`;
  }
  return null;
}

function extractJavaVersion(content: string, varName: string): string | null {
  const regex = new RegExp(`val\\s+${varName}:\\s*JavaVersion\\s*=\\s*JavaVersion\\.VERSION_(\\d+)`);
  const match = content.match(regex);
  if (match) {
    return match[1];
  }
  return null;
}

function extractIntVersion(content: string, varName: string): string | null {
  const regex = new RegExp(`val\\s+${varName}:\\s*Int\\s*=\\s*(\\d+)`);
  const match = content.match(regex);
  if (match) {
    return match[1];
  }
  return null;
}

// Scheduled function to run every day at midnight
export const fetchFlutterDependencyVersions = onSchedule('every 24 hours', async (event: any) => {
  try {
    const response = await axios.get(REPO_URL);
    const content = response.data as string;

    const warnGradleVersion = extractVersion(content, 'warnGradleVersion');
    const errorGradleVersion = extractVersion(content, 'errorGradleVersion');
    
    const warnAGPVersion = extractAgpVersion(content, 'warnAGPVersion');
    const errorAGPVersion = extractAgpVersion(content, 'errorAGPVersion');

    const warnKGPVersion = extractVersion(content, 'warnKGPVersion');
    const errorKGPVersion = extractVersion(content, 'errorKGPVersion');

    const errorJavaVersion = extractJavaVersion(content, 'errorJavaVersion');
    const warnJavaVersion = extractJavaVersion(content, 'warnJavaVersion');

    const errorMinSdkVersion = extractIntVersion(content, 'errorMinSdkVersion');
    const warnMinSdkVersion = extractIntVersion(content, 'warnMinSdkVersion');

    const versions = {
      gradle: {
        warn: warnGradleVersion,
        error: errorGradleVersion,
      },
      agp: {
        warn: warnAGPVersion,
        error: errorAGPVersion,
      },
      kgp: {
        warn: warnKGPVersion,
        error: errorKGPVersion,
      },
      java: {
        warn: warnJavaVersion,
        error: errorJavaVersion,
      },
      minSdk: {
        warn: warnMinSdkVersion,
        error: errorMinSdkVersion,
      },
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Save to Firestore
    await admin.firestore().collection('config').doc('flutterVersions').set(versions);
    logger.info("Successfully updated flutter dependency versions in Firestore.", versions);
  } catch (error) {
    logger.error("Error fetching or parsing flutter dependency versions.", error);
  }
});

// HTTP Callable function to read the versions (read-only)
export const getFlutterDependencyVersions = onRequest(async (req: any, res: any) => {
  // CORS setup if needed, though hosting rewrite avoids CORS mostly
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.status(204).send('');
    return;
  }

  try {
    const doc = await admin.firestore().collection('config').doc('flutterVersions').get();
    if (doc.exists) {
      res.json(doc.data());
    } else {
      res.status(404).json({ error: 'Versions not found.' });
    }
  } catch (error) {
    logger.error("Error reading versions.", error);
    res.status(500).json({ error: 'Unable to fetch versions' });
  }
});
