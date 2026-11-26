import { countInt, db } from "@/server/db";
import { jsonArrayFrom, jsonBuildObject, jsonObjectFrom } from "@/server/db/json";

// 以下函数返回查询（不执行），由页面接口合并为一条 SQL 后执行

/**
 * 材料列表。指定标签时只返回挂了该标签的材料；标签不属于本项目时视为未指定（与页面上的「全部」一致）。
 */
export function materialsQuery(projectId: string, tagId: string | null) {
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
      eb.or([
        eb.not(eb.exists(eb.selectFrom("Tag as t").where("t.id", "=", tagId).where("t.projectId", "=", projectId))),
        eb.exists(eb.selectFrom("MaterialTag as mt").whereRef("mt.materialId", "=", "m.id").where("mt.tagId", "=", tagId)),
      ]),
    );
  }
  return query.orderBy("m.createdAt", "desc");
}

/** 项目标签及各自的材料数 */
export function tagsQuery(projectId: string) {
  return db
    .selectFrom("Tag as t")
    .selectAll("t")
    .select((eb) => [
      jsonBuildObject({
        materials: eb
          .selectFrom("MaterialTag as mt")
          .select(countInt.as("n"))
          .whereRef("mt.tagId", "=", "t.id")
          .$castTo<number>(),
      }).as("_count"),
    ])
    .where("t.projectId", "=", projectId)
    .orderBy("t.name", "asc");
}
