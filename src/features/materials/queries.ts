import { sql } from "kysely";

import { db } from "@/server/db";
import { jsonArrayFrom, jsonBuildObject, jsonObjectFrom } from "@/server/db/json";

export function listMaterials(projectId: string, tagId?: string) {
  let query = db
    .selectFrom("Material as m")
    .selectAll("m")
    .select((eb) => [
      jsonObjectFrom(eb.selectFrom("User as u").select(["u.id", "u.name", "u.color"]).whereRef("u.id", "=", "m.uploaderId"))
        .$notNull()
        .as("uploader"),
      jsonObjectFrom(
        eb.selectFrom("Requirement as r").select(["r.number", "r.title"]).whereRef("r.id", "=", "m.requirementId"),
      ).as("requirement"),
      jsonArrayFrom(
        eb
          .selectFrom("MaterialTag as mt")
          .innerJoin("Tag as t", "t.id", "mt.tagId")
          .select((t) => [
            jsonBuildObject({
              id: t.ref("t.id"),
              projectId: t.ref("t.projectId"),
              name: t.ref("t.name"),
              color: t.ref("t.color"),
            }).as("tag"),
          ])
          .whereRef("mt.materialId", "=", "m.id"),
      ).as("tags"),
    ])
    .where("m.projectId", "=", projectId);
  if (tagId) {
    query = query.where((eb) =>
      eb.exists(eb.selectFrom("MaterialTag as mt").whereRef("mt.materialId", "=", "m.id").where("mt.tagId", "=", tagId)),
    );
  }
  return query.orderBy("m.createdAt", "desc").execute();
}

export async function listTags(projectId: string) {
  const rows = await db
    .selectFrom("Tag as t")
    .selectAll("t")
    .select((eb) => [
      eb
        .selectFrom("MaterialTag as mt")
        .select(sql<number>`count(*)::int`.as("n"))
        .whereRef("mt.tagId", "=", "t.id")
        .as("materials"),
    ])
    .where("t.projectId", "=", projectId)
    .orderBy("t.name", "asc")
    .execute();
  return rows.map(({ materials, ...tag }) => ({ ...tag, _count: { materials: materials ?? 0 } }));
}
