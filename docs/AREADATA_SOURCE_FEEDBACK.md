# AreaData source-feedback loop

AreaDataが国・地域のカバー範囲を広げる過程で確認した公式データソースを、Census Dashboard Kitの次回案件へ戻すための契約である。この経路はsourceの所在と再利用上の注意を共有する。数値観測、資格情報、大容量原本、取得済み・採用済みという現在案件の状態は移送しない。

## 循環

1. AreaDataは各国・地域の調査後に、[`schemas/areadata-source-feedback.schema.json`](../schemas/areadata-source-feedback.schema.json)へ適合するbundleを生成する。
2. bundleには公開HTTP(S)の公式・国際機関sourceだけを含め、AreaDataのcommit、証拠ファイルへの相対path、確認日、証拠段階、地理粒度、対象期間、format、再利用時の注意を残す。
3. Kit側で最初にdry-runする。

   ```sh
   npm run sources:import:areadata -- --input C:/path/to/KIT_SOURCE_FEEDBACK.json --dry-run
   ```

4. 問題がなければ同じbundleをimportする。

   ```sh
   npm run sources:import:areadata -- --input C:/path/to/KIT_SOURCE_FEEDBACK.json
   npm run check
   npm test
   npm run verify:kit
   ```

5. import結果は[`config/areadata-source-feedback.json`](../config/areadata-source-feedback.json)へ決定的なIDでmergeされる。同じ国・role・URLの再取込は重複を作らず、確認日、証拠段階、対象期間、formatとorigin履歴を更新する。
6. 次回の国別生成では`SOURCE_PREFLIGHT.json`と`.md`の`areadata_source_feedback`に該当国の記録が自動表示される。担当者は一般検索より先に確認するが、URL再確認、原本取得、本文・表検査、地理照合、指標採用を新案件でやり直す。

## 証拠段階

AreaDataから返せる段階は次のとおりである。

1. `official_location_identified`
2. `official_location_verified`
3. `source_acquired`
4. `content_inspected`
5. `geography_matched`
6. `indicator_adopted_in_areadata`

上位段階であっても、Kitの国別案件では常に`not_acquired_by_kit_preflight`から始まる。AreaDataで採用した値をKitの新案件へ自動移植しない。

## Bundle例

```json
{
  "schema_version": "1.0",
  "produced_by": "AreaData",
  "exported_at": "2026-09-23T12:00:00Z",
  "origin_commit": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "sources": [
    {
      "iso3": "DZA",
      "source_id": "DZA_ONS_RGPH",
      "role": "census_catalog",
      "title": "RGPH census catalogue",
      "publisher": "Office national des statistiques",
      "url": "https://www.ons.dz/spip.php?rubrique390",
      "authority_type": "official_national",
      "evidence_stage": "official_location_verified",
      "checked_at": "2026-09-23",
      "geographic_levels": ["national"],
      "reference_periods": ["2022 listing", "2008 linked edition"],
      "formats": ["HTML"],
      "license_or_terms": null,
      "reuse_note": "Keep the unlinked 2022 listing separate from the linked 2008 edition.",
      "origin_evidence_path": "evidence/DZA/SOURCE_RESOURCE_INVENTORY.json",
      "artifact_sha256": null
    }
  ]
}
```

## 公開安全境界

- URLのusername、password、API key、token、署名、秘密query parameterは拒否する。
- localhost、loopback、`.local`、絶対path、親directoryへ出る証拠pathは拒否する。
- Kit台帳へ個票・観測値・raw原本を入れない。
- bundleの未知fieldを拒否し、意図しない情報の公開を防ぐ。
- sourceの不存在、利用不能、法的状態を検索失敗だけから断定しない。

AreaDataの各カバー拡張作業は、完了時にこのbundleを更新し、Kit取込担当へcommitとbundle pathを通知する。Kit取込後は、KitのcommitをAreaData側の外部台帳へ再固定する。これによりKit → AreaData → Kitの循環を追跡可能にする。
