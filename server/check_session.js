const { db } = require('./db');

try {
    const patients = db.prepare("SELECT * FROM patients WHERE first_name LIKE ?").all('%Jesus%');
    console.log("Patients found:", JSON.stringify(patients, null, 2));

    const allCitations = db.prepare("SELECT * FROM session_persistence").all();
    console.log("Session Persistence rows:", allCitations);
} catch (err) {
    console.error("Error querying database:", err.message);
}
db.close();
