const {query} = require("../db");
const CustomError = require("../model/CustomError");

exports.saveFormQuestions = async ({eventId, questions}) => {
    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    if (!questions || !Array.isArray(questions)) {
        throw new CustomError("Questions array is required", 400);
    }

    // Validate each question
    questions.forEach((question, index) => {
        if (!question.text || !question.text.trim()) {
            throw new CustomError(`Question ${index + 1}: Text is required`, 400);
        }
        if (!question.type || !question.type.trim()) {
            throw new CustomError(`Question ${index + 1}: Type is required`, 400);
        }
        if (typeof question.required !== "boolean") {
            throw new CustomError(
                `Question ${index + 1}: Required field must be boolean`,
                400,
            );
        }
    });

    // Delete existing questions for this event
    const deleteSql = `
        DELETE FROM form_question
        WHERE event_id = $1
    `;
    await query(deleteSql, [eventId]);

    // Insert new questions
    if (questions.length > 0) {
        const insertSql = `
            INSERT INTO form_question (event_id, text, type, required, options, order_index)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;

        const results = await Promise.all(
            questions.map((question, index) =>
                query(insertSql, [
                    eventId,
                    question.text,
                    question.type,
                    question.required,
                    JSON.stringify(question.options || []),
                    index,
                ]),
            ),
        );

        return results.map((result) => result.rows[0]);
    }

    return [];
};

exports.getFormQuestions = async ({eventId}) => {
    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    const sql = `
        SELECT *
        FROM form_question
        WHERE event_id = $1
        ORDER BY id
    `;
    const result = await query(sql, [eventId]);
    return result.rows;
};
