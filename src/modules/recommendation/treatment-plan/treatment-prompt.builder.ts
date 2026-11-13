import { TreatmentFacts } from './treatment-plan.types';

const ANSWER_SHAPE = `{
  "summary": "2-4 речення: що робимо і чому",
  "applications": [
    { "productId": "id з переліку", "rateValue": 0.0, "waterLPerHa": 0, "dayOffset": 0, "timing": "коли саме (фаза, погода, час доби)", "note": "на що звернути увагу" }
  ],
  "precautions": ["заходи безпеки"],
  "monitoring": "коли і як перевірити результат"
}`;

/** The model writes the course; every number it may use comes from the registry facts in the user message. */
export function buildTreatmentSystemPrompt(): string {
  return [
    'Ти — досвідчений агроном-консультант із захисту рослин в Україні. Склади курс обробок для поля.',
    'Суворі правила:',
    '1. Використовуй ЛИШЕ препарати з переліку "products" і їхні productId. Не вигадуй інших препаратів.',
    '2. rateValue — у межах [rateMin, rateMax] препарату, в одиницях rateUnit.',
    '3. Не більше maxApplications обробок одним препаратом; між обробками одним препаратом — не менше minIntervalDays днів.',
    '4. waterLPerHa — у межах waterLPerHa.min..max (норма витрати робочого розчину).',
    '5. dayOffset — день обробки від першої (перша = 0). Чергуй препарати різних груп резистентності, якщо їх кілька.',
    '6. Зважай на фазу BBCH (bbchFrom..bbchTo), погоду (weatherVerdict) і попередження (warningCodes).',
    '7. Якщо обробка не потрібна (actionLevel = observe), поверни порожній applications і поясни в summary.',
    '8. Не рахуй кількість препарату на бак чи поле — це зробить програма.',
    'Пиши українською. Відповідай одним JSON-об\'єктом такої форми:',
    ANSWER_SHAPE,
  ].join('\n');
}

export function buildTreatmentUserPrompt(facts: TreatmentFacts): string {
  return `Дані поля і дозволені препарати (з державного реєстру):\n${JSON.stringify(facts, null, 2)}`;
}
