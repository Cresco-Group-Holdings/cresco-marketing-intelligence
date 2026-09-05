import {
  formatProductionConfigReport,
  runProductionConfigValidation,
} from "../src/lib/security/production-config";

const report = runProductionConfigValidation();
console.log(formatProductionConfigReport(report));
process.exit(report.passed ? 0 : 1);
