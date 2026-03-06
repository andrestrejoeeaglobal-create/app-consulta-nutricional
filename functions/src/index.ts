import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { processPatientBiomarkers } from "./cortex/reasoning";

admin.initializeApp();

/**
 * Cloud Function Trigger: Observes changes in the /patients/{patientId} collection.
 * Acts as the "watcher" or circulatory system of the T.I.L.O ecosystem.
 */
export const onPatientUpdated = functions.firestore
    .document("patients/{patientId}")
    .onUpdate(async (change, context) => {
        const newData = change.after.data();
        const previousData = change.before.data();
        const patientId = context.params.patientId;

        console.log(`[Cortex Watcher] Analyzing patient ${patientId}`);

        // Simple heuristic: Only trigger Cortex reasoning if vital signs, diet, or habits changed
        const vitalsChanged = JSON.stringify(newData.signosVitales) !== JSON.stringify(previousData.signosVitales);
        const metricsChanged = JSON.stringify(newData.vitales_antropometria) !== JSON.stringify(previousData.vitales_antropometria);
        const historyChanged = JSON.stringify(newData.history) !== JSON.stringify(previousData.history);

        if (!vitalsChanged && !metricsChanged && !historyChanged) {
            console.log(`[Cortex Watcher] No critical biomarkers changed for patient ${patientId}. Skipping reasoning.`);
            return null;
        }

        console.log(`[Cortex Watcher] Triggering Nutritional Cortex for ${patientId}`);

        try {
            // Invokes the reasoning module (which interfaces with NotebookLM in the background)
            const reasoningResult = await processPatientBiomarkers(newData);

            // Write the evaluation back to Firestore, closing the reactive loop
            const timestamp = admin.firestore.FieldValue.serverTimestamp();

            await admin.firestore()
                .collection("patients")
                .doc(patientId)
                .collection("cortex_evaluations")
                .add({
                    ...reasoningResult,
                    evaluado_en: timestamp,
                    trigger: "onUpdate"
                });

            console.log(`[Cortex Watcher] Reasoning saved for ${patientId}`);
        } catch (error) {
            console.error(`[Cortex Watcher] Cortex Engine failure for ${patientId}:`, error);
        }

        return null;
    });
