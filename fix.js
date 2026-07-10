const fs = require('fs');
let c = fs.readFileSync('client/src/components/interview/Fase5_EstiloVida.jsx', 'utf8');

c = c.replace('// eslint-disable-next-line react-hooks/exhaustive-deps\\n        return () => { isMounted = false; };\\n    }, [patientData?.identificacion?.codigoPostal, patientProfile?.postalCode, firstName]);', 'return () => { isMounted = false; };\\n        // eslint-disable-next-line react-hooks/exhaustive-deps\\n    }, [patientData?.identificacion?.codigoPostal, patientProfile?.postalCode, firstName]);');

c = c.replace('// eslint-disable-next-line react-hooks/exhaustive-deps\\r\\n        return () => { isMounted = false; };\\r\\n    }, [patientData?.identificacion?.codigoPostal, patientProfile?.postalCode, firstName]);', 'return () => { isMounted = false; };\\r\\n        // eslint-disable-next-line react-hooks/exhaustive-deps\\r\\n    }, [patientData?.identificacion?.codigoPostal, patientProfile?.postalCode, firstName]);');

fs.writeFileSync('client/src/components/interview/Fase5_EstiloVida.jsx', c);
