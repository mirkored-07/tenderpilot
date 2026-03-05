/* scripts/update-i18n-copy.js
   Run: node scripts/update-i18n-copy.js
*/
const fs = require("fs");
const path = require("path");

const DICTS_DIR = path.join(process.cwd(), "dictionaries");
const LANGS = ["en", "de", "it", "fr", "es"];

function setPath(obj, dotted, value) {
  const parts = dotted.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function patchDict(lang, d) {
  // Landing: add missing label
  if (d.landing && d.landing.nav) {
    const landingLang = { en: "Language", de: "Sprache", it: "Lingua", fr: "Langue", es: "Idioma" };
    d.landing.nav.language = landingLang[lang];
  }

  // Common additions
  const save = { en: "Save", de: "Speichern", it: "Salva", fr: "Enregistrer", es: "Guardar" };
  const reset = {
    en: "Reset filters",
    de: "Filter zurücksetzen",
    it: "Reimposta filtri",
    fr: "Réinitialiser les filtres",
    es: "Restablecer filtros",
  };
  setPath(d, "app.common.save", save[lang]);
  setPath(d, "app.common.resetFilters", reset[lang]);

  // Rename modal placeholder
  const renamePh = {
    en: "Tender name",
    de: "Name der Ausschreibung",
    it: "Nome del bando",
    fr: "Nom de l'appel d'offres",
    es: "Nombre de la licitación",
  };
  setPath(d, "app.review.rename.placeholder", renamePh[lang]);

  // Upload: missing keys referenced by UI
  const uploadErrors = {
    en: {
      unreadable: "We could not read this file. Please try another file.",
      empty: "This file looks empty.",
      tooLarge: "File is too large (max {max}).",
      unsupported: "Unsupported file type. Upload a PDF or DOCX.",
      uploadFailed: "Upload failed. Please try again.",
      uploadFailedShort: "Upload failed.",
      accountSetupIncomplete: "Account setup is incomplete. Please sign out and sign in again.",
      createJobFailed: "Could not start the review. Please try again.",
    },
    de: {
      unreadable: "Diese Datei konnte nicht gelesen werden. Bitte versuche eine andere Datei.",
      empty: "Diese Datei scheint leer zu sein.",
      tooLarge: "Die Datei ist zu groß (max. {max}).",
      unsupported: "Dateityp nicht unterstützt. Bitte PDF oder DOCX hochladen.",
      uploadFailed: "Upload fehlgeschlagen. Bitte erneut versuchen.",
      uploadFailedShort: "Upload fehlgeschlagen.",
      accountSetupIncomplete: "Account-Setup unvollständig. Bitte abmelden und erneut anmelden.",
      createJobFailed: "Review konnte nicht gestartet werden. Bitte erneut versuchen.",
    },
    it: {
      unreadable: "Non riusciamo a leggere questo file. Prova con un altro file.",
      empty: "Questo file sembra vuoto.",
      tooLarge: "Il file è troppo grande (max {max}).",
      unsupported: "Tipo di file non supportato. Carica un PDF o un DOCX.",
      uploadFailed: "Caricamento non riuscito. Riprova.",
      uploadFailedShort: "Caricamento non riuscito.",
      accountSetupIncomplete: "Configurazione account incompleta. Esci e accedi di nuovo.",
      createJobFailed: "Impossibile avviare l’analisi. Riprova.",
    },
    fr: {
      unreadable: "Impossible de lire ce fichier. Essayez avec un autre fichier.",
      empty: "Ce fichier semble vide.",
      tooLarge: "Le fichier est trop volumineux (max {max}).",
      unsupported: "Type de fichier non pris en charge. Importez un PDF ou un DOCX.",
      uploadFailed: "Échec de l’import. Réessayez.",
      uploadFailedShort: "Échec de l’import.",
      accountSetupIncomplete: "Configuration du compte incomplète. Déconnectez-vous puis reconnectez-vous.",
      createJobFailed: "Impossible de démarrer l’analyse. Réessayez.",
    },
    es: {
      unreadable: "No pudimos leer este archivo. Prueba con otro archivo.",
      empty: "Este archivo parece vacío.",
      tooLarge: "El archivo es demasiado grande (máx. {max}).",
      unsupported: "Tipo de archivo no compatible. Sube un PDF o un DOCX.",
      uploadFailed: "La carga falló. Inténtalo de nuevo.",
      uploadFailedShort: "La carga falló.",
      accountSetupIncomplete: "La configuración de la cuenta está incompleta. Cierra sesión e inicia sesión otra vez.",
      createJobFailed: "No se pudo iniciar el análisis. Inténtalo de nuevo.",
    },
  };
  const uploadPhases = {
    en: {
      checkingSession: "Checking session…",
      uploading: "Uploading…",
      creatingJob: "Starting review…",
      extractingText: "Extracting text…",
      redirecting: "Opening review…",
    },
    de: {
      checkingSession: "Sitzung wird geprüft…",
      uploading: "Upload läuft…",
      creatingJob: "Review wird gestartet…",
      extractingText: "Text wird extrahiert…",
      redirecting: "Review wird geöffnet…",
    },
    it: {
      checkingSession: "Controllo sessione…",
      uploading: "Caricamento…",
      creatingJob: "Avvio analisi…",
      extractingText: "Estrazione testo…",
      redirecting: "Apertura analisi…",
    },
    fr: {
      checkingSession: "Vérification de la session…",
      uploading: "Import en cours…",
      creatingJob: "Démarrage de l’analyse…",
      extractingText: "Extraction du texte…",
      redirecting: "Ouverture de l’analyse…",
    },
    es: {
      checkingSession: "Comprobando sesión…",
      uploading: "Subiendo…",
      creatingJob: "Iniciando análisis…",
      extractingText: "Extrayendo texto…",
      redirecting: "Abriendo análisis…",
    },
  };
  setPath(d, "app.upload.errors", uploadErrors[lang]);
  setPath(d, "app.upload.phases", uploadPhases[lang]);

  // Review progress hint + microcopy translations
  const stepsHint = {
    en: "You can leave this tab open. It will update automatically.",
    de: "Du kannst diesen Tab offen lassen. Er aktualisiert sich automatisch.",
    it: "Puoi lasciare questa scheda aperta. Si aggiorna automaticamente.",
    fr: "Vous pouvez laisser cet onglet ouvert. Il se met à jour automatiquement.",
    es: "Puedes dejar esta pestaña abierta. Se actualizará automáticamente.",
  };
  setPath(d, "app.review.progress.stepsHint", stepsHint[lang]);

  const clarifSubject = {
    en: "Clarification questions for {tender}",
    de: "Rückfragen zur Ausschreibung: {tender}",
    it: "Domande di chiarimento per {tender}",
    fr: "Questions de clarification pour {tender}",
    es: "Preguntas de aclaración sobre {tender}",
  };
  setPath(d, "app.review.clarifications.email.subject", clarifSubject[lang]);
  setPath(d, "app.exports.tenderBrief.buyerEmail.subject", clarifSubject[lang]);

  const locate = {
    en: "Locate (approximate)",
    de: "Finden (ungefähr)",
    it: "Trova (approssimativo)",
    fr: "Localiser (approximatif)",
    es: "Localizar (aprox.)",
  };
  setPath(d, "app.review.source.locateBestEffort", locate[lang]);

  // Compliance matrix
  const noteBase = {
    en: "From Compliance Matrix. Status: {status}",
    de: "Aus der Compliance-Matrix. Status: {status}",
    it: "Da Matrice di conformità. Stato: {status}",
    fr: "Depuis la matrice de conformité. Statut : {status}",
    es: "Desde la matriz de cumplimiento. Estado: {status}",
  };
  const covered = {
    en: "Covered, no task needed",
    de: "Abgedeckt, keine Aufgabe nötig",
    it: "Coperto, nessuna attività necessaria",
    fr: "Couvert, aucune tâche nécessaire",
    es: "Cubierto, no hace falta tarea",
  };
  const helper = {
    en: "This is coverage tracking. Use Bid Room for owners, due dates, and status.",
    de: "Hier geht es um Abdeckung. Für Owner, Termine und Status nutze den Bid Room.",
    it: "Qui tracci la copertura. Per owner, scadenze e stato usa il Bid Room.",
    fr: "Ici, vous suivez la couverture. Pour les responsables, dates et statuts, utilisez le Bid Room.",
    es: "Aquí controlas la cobertura. Para responsables, fechas y estado, usa el Bid Room.",
  };
  const evidenceCount = {
    en: "Evidence IDs: {count}",
    de: "Evidenz-IDs: {count}",
    it: "ID evidenze: {count}",
    fr: "IDs de preuve : {count}",
    es: "IDs de evidencia: {count}",
  };
  const evidenceNotFound = {
    en: "Evidence {id} was not found in this tender’s evidence map. Verify in the PDF.",
    de: "Evidenz {id} wurde in dieser Ausschreibung nicht gefunden. Bitte im PDF prüfen.",
    it: "L’evidenza {id} non è stata trovata per questo bando. Verifica nel PDF.",
    fr: "La preuve {id} est introuvable pour cet appel d’offres. Vérifiez dans le PDF.",
    es: "La evidencia {id} no se encontró en esta licitación. Verifícalo en el PDF.",
  };

  setPath(d, "app.compliance.send.noteBase", noteBase[lang]);
  setPath(d, "app.compliance.coveredNoTask", covered[lang]);
  setPath(d, "app.compliance.helper.notTaskTracking", helper[lang]);
  setPath(d, "app.compliance.labels.evidenceCount", evidenceCount[lang]);
  setPath(d, "app.compliance.errors.evidenceNotFound", evidenceNotFound[lang]);

  // Bid Room
  const addNote = { en: "Add note", de: "Notiz hinzufügen", it: "Aggiungi nota", fr: "Ajouter une note", es: "Añadir nota" };
  const openEvidence = { en: "Open evidence", de: "Evidenz öffnen", it: "Apri evidenza", fr: "Ouvrir la preuve", es: "Abrir evidencia" };

  const typeGroups = {
    en: { requirement: "Requirements", risk: "Risks", clarification: "Clarifications", outline: "Outline" },
    de: { requirement: "Anforderungen", risk: "Risiken", clarification: "Rückfragen", outline: "Gliederung" },
    it: { requirement: "Requisiti", risk: "Rischi", clarification: "Chiarimenti", outline: "Struttura" },
    fr: { requirement: "Exigences", risk: "Risques", clarification: "Clarifications", outline: "Plan" },
    es: { requirement: "Requisitos", risk: "Riesgos", clarification: "Aclaraciones", outline: "Esquema" },
  };

  const evidenceSubtitle = {
    en: "Excerpts are verbatim. Use Locate in PDF to jump to the spot; it may be off.",
    de: "Auszüge sind wortgetreu. „Im PDF finden“ hilft beim Springen, kann aber ungenau sein.",
    it: "Gli estratti sono testuali. “Trova nel PDF” aiuta a saltare al punto, ma può non essere preciso.",
    fr: "Les extraits sont verbatim. “Localiser dans le PDF” aide à se placer au bon endroit, mais peut être imprécis.",
    es: "Los extractos son textuales. “Localizar en PDF” ayuda a ir al punto, pero puede no ser exacto.",
  };

  const evidenceLabels = {
    en: { id: "ID", page: "Page", anchor: "Anchor" },
    de: { id: "ID", page: "Seite", anchor: "Anker" },
    it: { id: "ID", page: "Pagina", anchor: "Ancora" },
    fr: { id: "ID", page: "Page", anchor: "Ancre" },
    es: { id: "ID", page: "Página", anchor: "Ancla" },
  };

  setPath(d, "app.bidroom.actions.addNote", addNote[lang]);
  setPath(d, "app.bidroom.actions.openEvidence", openEvidence[lang]);
  setPath(d, "app.bidroom.panel.typeGroups", typeGroups[lang]);
  setPath(d, "app.bidroom.evidence.subtitle", evidenceSubtitle[lang]);
  setPath(d, "app.bidroom.evidence.labels", evidenceLabels[lang]);

  // Sample page
  const sampleTabs = {
    en: { cockpit: "Cockpit", evidence: "Evidence & source", dashboard: "Dashboard" },
    de: { cockpit: "Cockpit", evidence: "Evidenz & Quelle", dashboard: "Dashboard" },
    it: { cockpit: "Cockpit", evidence: "Evidenza e fonte", dashboard: "Dashboard" },
    fr: { cockpit: "Cockpit", evidence: "Preuve & source", dashboard: "Tableau de bord" },
    es: { cockpit: "Cockpit", evidence: "Evidencia y fuente", dashboard: "Panel" },
  };
  const sampleLabels = {
    en: {
      ready: "Ready",
      textExtracted: "Text extracted",
      reviewReady: "Your tender review is ready.",
      disclaimer: "Drafting support only. Always verify against the original tender document.",
      back: "Back",
      downloadBidPack: "Download Bid Pack (Excel)",
      openBidRoom: "Open Bid Room",
      sendToBidRoom: "Send to Bid Room",
      backToJob: "Back to job",
      structuredDriversOnly: "Structured drivers only. Verify using Evidence & source.",
    },
    de: {
      ready: "Bereit",
      textExtracted: "Text extrahiert",
      reviewReady: "Deine Tender-Analyse ist bereit.",
      disclaimer: "Nur Unterstützung beim Drafting. Bitte immer mit dem Originaldokument prüfen.",
      back: "Zurück",
      downloadBidPack: "Bid Pack herunterladen (Excel)",
      openBidRoom: "Bid Room öffnen",
      sendToBidRoom: "In den Bid Room senden",
      backToJob: "Zurück zum Review",
      structuredDriversOnly: "Nur strukturierte Hinweise. Bitte über Evidenz & Quelle verifizieren.",
    },
    it: {
      ready: "Pronto",
      textExtracted: "Testo estratto",
      reviewReady: "La tua analisi del bando è pronta.",
      disclaimer: "Solo supporto alla stesura. Verifica sempre con il documento originale.",
      back: "Indietro",
      downloadBidPack: "Scarica Bid Pack (Excel)",
      openBidRoom: "Apri Bid Room",
      sendToBidRoom: "Invia al Bid Room",
      backToJob: "Torna al review",
      structuredDriversOnly: "Indicatori strutturati. Verifica in Evidenza e fonte.",
    },
    fr: {
      ready: "Prêt",
      textExtracted: "Texte extrait",
      reviewReady: "Votre analyse est prête.",
      disclaimer: "Aide à la rédaction uniquement. Vérifiez toujours avec le document original.",
      back: "Retour",
      downloadBidPack: "Télécharger le Bid Pack (Excel)",
      openBidRoom: "Ouvrir le Bid Room",
      sendToBidRoom: "Envoyer au Bid Room",
      backToJob: "Retour au dossier",
      structuredDriversOnly: "Indicateurs structurés uniquement. Vérifiez via Preuve & source.",
    },
    es: {
      ready: "Listo",
      textExtracted: "Texto extraído",
      reviewReady: "Tu análisis está listo.",
      disclaimer: "Solo apoyo a la redacción. Verifica siempre con el documento original.",
      back: "Volver",
      downloadBidPack: "Descargar Bid Pack (Excel)",
      openBidRoom: "Abrir Bid Room",
      sendToBidRoom: "Enviar al Bid Room",
      backToJob: "Volver al dossier",
      structuredDriversOnly: "Solo señales estructuradas. Verifica en Evidencia y fuente.",
    },
  };

  const existingTabs = (d.samplePage && d.samplePage.tabs) ? d.samplePage.tabs : {};
  setPath(d, "samplePage.tabs", { ...existingTabs, ...sampleTabs[lang] });

  const existingLabels = (d.samplePage && d.samplePage.labels) ? d.samplePage.labels : {};
  setPath(d, "samplePage.labels", { ...existingLabels, ...sampleLabels[lang] });

  const decisionLine = {
    en: "Hold: Two blockers need clarification before bidding: acceptance testing and SLA penalties.",
    de: "Hold: Zwei Blocker müssen vor dem Bieten geklärt werden: Abnahmetests und SLA-Pönalen.",
    it: "Hold: due blocchi vanno chiariti prima di partecipare: test di accettazione e penali SLA.",
    fr: "Hold : deux blocages doivent être clarifiés avant de répondre : tests de réception et pénalités SLA.",
    es: "Hold: dos bloqueadores deben aclararse antes de presentar oferta: pruebas de aceptación y penalizaciones SLA.",
  };
  setPath(d, "samplePage.data.decisionLine", decisionLine[lang]);

  const authLogin = {
    en: { title: "Sign in", subtitle: "We’ll email you a secure login link.", emailPlaceholder: "you@company.com", cta: "Send login link", sent: "Check your inbox and open the link." },
    de: { title: "Anmelden", subtitle: "Wir senden dir einen sicheren Login-Link per E-Mail.", emailPlaceholder: "du@firma.com", cta: "Login-Link senden", sent: "Posteingang prüfen und den Link öffnen." },
    it: { title: "Accedi", subtitle: "Ti invieremo un link di accesso sicuro via email.", emailPlaceholder: "tu@azienda.com", cta: "Invia link di accesso", sent: "Controlla la posta e apri il link." },
    fr: { title: "Se connecter", subtitle: "Nous vous enverrons un lien de connexion sécurisé par e-mail.", emailPlaceholder: "vous@entreprise.com", cta: "Envoyer le lien", sent: "Vérifiez votre boîte mail et ouvrez le lien." },
    es: { title: "Iniciar sesión", subtitle: "Te enviaremos un enlace seguro por correo.", emailPlaceholder: "tu@empresa.com", cta: "Enviar enlace", sent: "Revisa tu correo y abre el enlace." },
  };
  setPath(d, "app.auth.login", authLogin[lang]);

  return d;
}

function main() {
  for (const lang of LANGS) {
    const file = path.join(DICTS_DIR, `${lang}.json`);
    const raw = fs.readFileSync(file, "utf8");
    const d = JSON.parse(raw);
    const patched = patchDict(lang, d);
    fs.writeFileSync(file, JSON.stringify(patched, null, 2) + "\n", "utf8");
    console.log(`Patched ${lang}.json`);
  }
}

main();
