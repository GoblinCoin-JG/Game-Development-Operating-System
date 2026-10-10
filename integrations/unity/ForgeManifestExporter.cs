#if UNITY_EDITOR
using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

// Copy into Assets/Editor. Read-only discovery: never changes .meta files or scenes.
public static class ForgeManifestExporter
{
    [Serializable] public class AssetEntry
    {
        public string guid;
        public string path;
        public string type;
        public string[] dependencies;
    }
    [Serializable] public class Manifest
    {
        public int version = 1;
        public string unityVersion;
        public string exportedAt;
        public AssetEntry[] assets;
    }
    [MenuItem("Tools/Forge/Export read-only asset manifest")]
    public static void Export()
    {
        var destination = EditorUtility.SaveFilePanel("Export Forge asset manifest", "", "forge-unity-manifest", "json");
        if (string.IsNullOrEmpty(destination)) return;
        var manifest = new Manifest {
            unityVersion = Application.unityVersion,
            exportedAt = DateTime.UtcNow.ToString("o"),
            assets = AssetDatabase.FindAssets("").Select(guid => {
                var assetPath = AssetDatabase.GUIDToAssetPath(guid);
                return new AssetEntry {
                    guid = guid,
                    path = assetPath,
                    type = AssetDatabase.GetMainAssetTypeAtPath(assetPath)?.FullName ?? "Unknown",
                    dependencies = AssetDatabase.GetDependencies(assetPath, false)
                };
            }).Where(a => !AssetDatabase.IsValidFolder(a.path)).ToArray()
        };
        File.WriteAllText(destination, JsonUtility.ToJson(manifest, true));
        Debug.Log("Forge: exported read-only discovery manifest. This does not assert test or playtest validation.");
    }
}
#endif
